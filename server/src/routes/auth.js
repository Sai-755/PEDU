import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db.js';
import nodemailer from 'nodemailer';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let schemaReady;

async function ensureAccountTables() {
  if (!schemaReady) schemaReady = (async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      email_verified_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const [columns] = await db.execute("SHOW COLUMNS FROM users LIKE 'email_verified_at'");
    if (!columns.length) await db.execute('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL AFTER password_hash');
    const [phoneColumns] = await db.execute("SHOW COLUMNS FROM users LIKE 'phone'");
    if (!phoneColumns.length) await db.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER email');

    await db.execute(`CREATE TABLE IF NOT EXISTS saved_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      job_id VARCHAR(512) NOT NULL,
      title VARCHAR(300) NOT NULL,
      category VARCHAR(100) NULL,
      source_url VARCHAR(2048) NOT NULL,
      saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY user_saved_job (user_id, job_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.execute("CREATE TABLE IF NOT EXISTS job_applications (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, job_id VARCHAR(512) NOT NULL, title VARCHAR(300) NOT NULL, category VARCHAR(100) NULL, source_url VARCHAR(2048) NOT NULL, status ENUM('Interested','Applied','Interview','Offer','Rejected') NOT NULL DEFAULT 'Interested', notes TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY user_application_job (user_id, job_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await db.execute("CREATE TABLE IF NOT EXISTS saved_searches (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, keywords VARCHAR(200) NOT NULL DEFAULT '', category VARCHAR(150) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY user_saved_search (user_id, name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  })().catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
}

function issueToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('Authentication is not configured. Set JWT_SECRET in server/.env.');
  return jwt.sign({ sub: String(user.id), role: 'learner', email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'pvgj-api', audience: 'pvgj-user' });
}
function currentUser(req) {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
  if (!match || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'pvgj-api', audience: 'pvgj-user' });
    return payload.role === 'learner' ? payload : null;
  } catch { return null; }
}
function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) { res.status(401).json({ message: 'Please sign in to continue.' }); return null; }
  return user;
}

function verificationUrl(userId, email) {
  const token = jwt.sign({ sub: String(userId), email, purpose: 'email-verification' }, process.env.JWT_SECRET, { expiresIn: '24h', issuer: 'pvgj-api', audience: 'pvgj-email-verification' });
  const apiBase = (process.env.API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
  return apiBase + '/auth/verify-email?token=' + encodeURIComponent(token);
}
async function sendVerificationEmail(email, url) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email verification is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM.');
    console.info('PVGJ email verification link for ' + email + ': ' + url); return;
  }
  const port = Number(SMTP_PORT || 587);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
  await transport.sendMail({ from: EMAIL_FROM, to: email, subject: 'Verify your PVGJ account', text: 'Verify your email within 24 hours: ' + url, html: '<p>Welcome to PVGJ.</p><p><a href="' + url + '">Verify your email address</a></p><p>This link expires in 24 hours.</p>' });
}
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120 || !emailPattern.test(cleanEmail) || cleanEmail.length > 254 || typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Enter your name, a valid email, and a password of at least 8 characters.' });
    if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'Authentication is not configured. Set JWT_SECRET in server/.env.' });
    await ensureAccountTables();
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute('INSERT INTO users (name, email, password_hash, email_verified_at) VALUES (?, ?, ?, NULL)', [name.trim(), cleanEmail, passwordHash]);
    const url = verificationUrl(result.insertId, cleanEmail);
    try { await sendVerificationEmail(cleanEmail, url); }
    catch (error) { await db.execute('DELETE FROM users WHERE id = ? AND email_verified_at IS NULL', [result.insertId]); error.verificationEmailFailed = true; throw error; }
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({ message: 'Account created. Check your inbox and follow the verification link before signing in.', verificationUrl: process.env.NODE_ENV === 'production' ? undefined : url });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    if (error.verificationEmailFailed) return res.status(503).json({ message: 'We could not send the verification email. Check your SMTP settings and try again.' });
    next(error);
  }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'pvgj-api', audience: 'pvgj-email-verification' });
    if (payload.purpose !== 'email-verification' || !payload.sub || !emailPattern.test(payload.email || '')) return res.status(400).json({ message: 'This verification link is invalid.' });
    await ensureAccountTables();
    await db.execute('UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ? AND email = ?', [payload.sub, payload.email]);
    const [rows] = await db.execute('SELECT email_verified_at FROM users WHERE id = ? AND email = ?', [payload.sub, payload.email]);
    if (!rows.length) return res.status(400).json({ message: 'This verification link is invalid.' });
    const message = 'Your email address is verified. You can now sign in.';
    if (req.accepts('html')) {
      res.set('Cache-Control', 'no-store');
      return res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email verified - PVGJ</title><body style="font-family:Arial,sans-serif;background:#f4f6f1;color:#173b2d;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:480px;margin:24px;padding:36px;background:white;border:1px solid #e1e8df;border-radius:16px"><h1>Email verified</h1><p>Your PVGJ email address is verified. Return to the PVGJ website and sign in.</p></main></body></html>');
    }
    return res.json({ verified: Boolean(rows[0].email_verified_at), message });
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') return res.status(400).json({ message: 'This verification link is invalid or has expired.' });
    next(error);
  }
});
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!emailPattern.test(cleanEmail) || typeof password !== 'string' || password.length > 128) return res.status(400).json({ message: 'Enter a valid email and password.' });
    await ensureAccountTables();
    const [rows] = await db.execute('SELECT id, name, email, password_hash, email_verified_at FROM users WHERE email = ?', [cleanEmail]);
    if (!rows.length) {
      await bcrypt.compare(password, '$2a$12$C6UzMDM.H6dfI/f/IKcEe.8fzPzQPE6xWqTdC5ZdQf9IYBN2kZ4eW');
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    const matches = await bcrypt.compare(password, rows[0].password_hash);
    if (!matches) return res.status(401).json({ message: 'Incorrect email or password.' });
    if (!rows[0].email_verified_at) {
      const url = verificationUrl(rows[0].id, rows[0].email);
      await sendVerificationEmail(rows[0].email, url);
      return res.status(403).json({ message: 'Verify your email using the link we just sent before signing in.', verificationUrl: process.env.NODE_ENV === 'production' ? undefined : url });
    }
    const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, emailVerified: Boolean(rows[0].email_verified_at) };
    res.set('Cache-Control', 'no-store');
    return res.json({ token: issueToken(user), user });
  } catch (error) { next(error); }
});

router.get('/me', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    const [rows] = await db.execute('SELECT id, name, email, phone, email_verified_at, created_at FROM users WHERE id = ?', [payload.sub]);
    if (!rows.length) return res.status(401).json({ message: 'Your account could not be found. Please sign in again.' });
    const user = rows[0];
    return res.json({ user: { ...user, emailVerified: Boolean(user.email_verified_at) } });
  } catch (error) { next(error); }
});

router.patch('/me', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    const { name, phone } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) return res.status(400).json({ message: 'Your name must be between 2 and 120 characters.' });
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 30 || !/^[+()\-\s\d]*$/.test(phone))) return res.status(400).json({ message: 'Enter a valid phone number.' });
    await ensureAccountTables();
    await db.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name.trim(), phone?.trim() || null, payload.sub]);
    const [rows] = await db.execute('SELECT id, name, email, phone, email_verified_at, created_at FROM users WHERE id = ?', [payload.sub]);
    if (!rows.length) return res.status(404).json({ message: 'Account not found.' });
    return res.json({ user: { ...rows[0], emailVerified: Boolean(rows[0].email_verified_at) } });
  } catch (error) { next(error); }
});

router.get('/saved-jobs', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    const [rows] = await db.execute('SELECT job_id AS id, title, category, source_url AS sourceUrl, saved_at AS savedAt FROM saved_jobs WHERE user_id = ? ORDER BY saved_at DESC LIMIT 200', [payload.sub]);
    return res.json({ jobs: rows });
  } catch (error) { next(error); }
});

router.post('/saved-jobs', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    const { id, title, category, sourceUrl } = req.body || {};
    let url;
    try { url = new URL(sourceUrl); } catch { return res.status(400).json({ message: 'This job alert cannot be saved.' }); }
    if (typeof id !== 'string' || !id || id.length > 512 || typeof title !== 'string' || !title.trim() || title.trim().length > 300 || !['https:', 'http:'].includes(url.protocol) || !/(^|\.)freejobalert\.com$/i.test(url.hostname) || !url.pathname.startsWith('/articles/')) return res.status(400).json({ message: 'This job alert cannot be saved.' });
    await ensureAccountTables();
    await db.execute('INSERT INTO saved_jobs (user_id, job_id, title, category, source_url) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), category=VALUES(category), source_url=VALUES(source_url)', [payload.sub, id, title.trim(), typeof category === 'string' ? category.slice(0, 100) : null, url.href]);
    return res.status(201).json({ saved: true, id });
  } catch (error) { next(error); }
});

router.delete('/saved-jobs/:jobId', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    await db.execute('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [payload.sub, req.params.jobId]);
    return res.json({ saved: false });
  } catch (error) { next(error); }
});


const applicationStatuses = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected'];
function validTrackedJobUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    return ['https:', 'http:'].includes(url.protocol) && /(^|\.)freejobalert\.com$/i.test(url.hostname) && url.pathname.startsWith('/articles/') ? url.href : null;
  } catch { return null; }
}
router.get('/applications', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    const [rows] = await db.execute('SELECT job_id AS id, title, category, source_url AS sourceUrl, status, notes, created_at AS createdAt, updated_at AS updatedAt FROM job_applications WHERE user_id=? ORDER BY updated_at DESC LIMIT 200', [payload.sub]);
    return res.json({ applications: rows });
  } catch (error) { next(error); }
});
router.post('/applications', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    const { id, title, category, sourceUrl } = req.body || {};
    const cleanUrl = validTrackedJobUrl(sourceUrl);
    if (typeof id !== 'string' || !id || id.length > 512 || typeof title !== 'string' || !title.trim() || title.trim().length > 300 || !cleanUrl) return res.status(400).json({ message: 'This job alert cannot be added to your tracker.' });
    await ensureAccountTables();
    await db.execute('INSERT INTO job_applications (user_id, job_id, title, category, source_url) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), category=VALUES(category), source_url=VALUES(source_url)', [payload.sub, id, title.trim(), typeof category === 'string' ? category.slice(0, 100) : null, cleanUrl]);
    return res.status(201).json({ tracked: true, id });
  } catch (error) { next(error); }
});
router.patch('/applications/:jobId', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    const { status, notes } = req.body || {};
    if (status !== undefined && !applicationStatuses.includes(status)) return res.status(400).json({ message: 'Choose a valid application stage.' });
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) return res.status(400).json({ message: 'Notes must be 2,000 characters or fewer.' });
    await ensureAccountTables();
    const [result] = await db.execute('UPDATE job_applications SET status=COALESCE(?, status), notes=COALESCE(?, notes) WHERE user_id=? AND job_id=?', [status || null, notes === undefined ? null : notes, payload.sub, req.params.jobId]);
    if (!result.affectedRows) {
      const [existing] = await db.execute('SELECT job_id FROM job_applications WHERE user_id=? AND job_id=?', [payload.sub, req.params.jobId]);
      if (!existing.length) return res.status(404).json({ message: 'Tracked job not found.' });
    }
    return res.json({ updated: true });
  } catch (error) { next(error); }
});
router.delete('/applications/:jobId', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    await db.execute('DELETE FROM job_applications WHERE user_id=? AND job_id=?', [payload.sub, req.params.jobId]);
    return res.json({ tracked: false });
  } catch (error) { next(error); }
});
router.get('/saved-searches', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    const [rows] = await db.execute('SELECT id, name, keywords, category, created_at AS createdAt FROM saved_searches WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [payload.sub]);
    return res.json({ searches: rows });
  } catch (error) { next(error); }
});
router.post('/saved-searches', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    const { name, keywords = '', category = '' } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof keywords !== 'string' || keywords.length > 200 || typeof category !== 'string' || category.length > 150 || (!keywords.trim() && !category.trim())) return res.status(400).json({ message: 'Add a name and at least one search keyword or category.' });
    await ensureAccountTables();
    const [result] = await db.execute('INSERT INTO saved_searches (user_id, name, keywords, category) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE keywords=VALUES(keywords), category=VALUES(category)', [payload.sub, name.trim(), keywords.trim(), category.trim()]);
    return res.status(201).json({ saved: true, id: result.insertId || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A saved search with this name already exists.' });
    next(error);
  }
});
router.delete('/saved-searches/:id', async (req, res, next) => {
  try {
    const payload = requireUser(req, res); if (!payload) return;
    await ensureAccountTables();
    await db.execute('DELETE FROM saved_searches WHERE user_id=? AND id=?', [payload.sub, req.params.id]);
    return res.json({ saved: false });
  } catch (error) { next(error); }
});
export default router;

