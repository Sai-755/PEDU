import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' }
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please wait a few minutes before trying again.' }
});

// Password strength policy: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || !PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
  }
  return null;
}

// 1. Current Authenticated User (Fixes GET /api/auth/me)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(503).json({ message: 'Authentication secret not configured.' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, email_verified_at, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = rows[0];
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: Boolean(user.email_verified_at),
        createdAt: user.created_at
      }
    });
  } catch (err) {
    return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }
});

// 2. Update Learner Profile
router.put('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { name, phone } = req.body || {};

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    await db.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [name.trim(), phone?.trim() || null, decoded.id]);

    return res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// 3. Learner Registration
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await db.execute(
      'INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword, phone?.trim() || null]
    );

    return res.status(201).json({ message: 'Registration successful! You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

// 4. Learner Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash, phone, email_verified_at FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(503).json({ message: 'Server authentication configuration is incomplete.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: 'learner' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: Boolean(user.email_verified_at)
      }
    });
  } catch (err) {
    next(err);
  }
});

// 5. Forgot Password (Dynamically detects Live Production URL)
router.post('/forgot-password', forgotLimiter, async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [users] = await db.execute('SELECT id, name FROM users WHERE email = ?', [cleanEmail]);

    if (users.length === 0) {
      return res.json({ message: 'If an account exists with this email, a reset link has been dispatched.' });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(254) NOT NULL,
        token VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pwd_resets_token (token),
        INDEX idx_pwd_resets_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.execute('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);
    await db.execute(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [cleanEmail, resetToken, expiresAt]
    );

    // Dynamically detect domain from origin/referer so it points to production live URL
    const incomingOrigin = req.get('origin') || (req.get('referer') ? new URL(req.get('referer')).origin : null);
    const clientUrl = (incomingOrigin || process.env.CLIENT_URL || 'https://education-institution.onrender.com').replace(/\/$/, '');
    const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_KEY;
    const rawFrom = process.env.EMAIL_FROM || 'pvgjeducation@gmail.com';
    const fromEmail = (rawFrom.match(/<([^>]+)>/) ? rawFrom.match(/<([^>]+)>/)[1] : rawFrom).trim();

    if (apiKey) {
      const emailPayload = {
        sender: { name: 'PVGJ Support', email: fromEmail },
        to: [{ email: cleanEmail, name: user.name }],
        replyTo: { email: fromEmail, name: 'PVGJ Support' },
        subject: 'Reset your PVGJ account password',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #173b2d; max-width: 580px; margin: auto; border: 1px solid #e1e8df; border-radius: 12px;">
            <h2 style="color: #173b2d; margin-top: 0;">PVGJ Security</h2>
            <p>Dear ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to configure a new password:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="background-color: #173b2d; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 13px; color: #666; line-height: 1.5;">This link will remain active for 60 minutes. If you did not make this request, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #e1e8df; margin: 20px 0;" />
            <small style="color: #999;">If the button does not work, copy and paste this link into your browser: <br/>${resetLink}</small>
          </div>
        `
      };

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });
    }

    return res.json({ message: 'If an account exists with this email, a reset link has been dispatched.' });
  } catch (err) {
    next(err);
  }
});

// 6. Reset Password with Token
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const [records] = await db.execute(
      'SELECT email FROM password_resets WHERE token = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [token]
    );

    if (records.length === 0) {
      return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
    }

    const email = records[0].email;
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
    await db.execute('DELETE FROM password_resets WHERE email = ?', [email]);

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

export default router;