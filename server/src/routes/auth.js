import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' }
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please wait a few minutes before trying again.' }
});

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || !PASSWORD_REGEX.test(password)) {
    return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
  }
  return null;
}

// Authentication Middleware with strict pvgj-api claims matching learning.js
function authenticateToken(req, res, next) {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
  if (!match || !process.env.JWT_SECRET) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'pvgj-api',
      audience: 'pvgj-user'
    });

    if (payload.role !== 'learner' || !payload.sub) {
      throw new Error('Invalid learner token');
    }

    req.user = {
      ...payload,
      id: Number(payload.sub) || payload.id
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' });
  }
}

// 1. Current Authenticated User (GET /api/auth/me)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, email_verified_at, created_at FROM users WHERE id = ?',
      [req.user.id]
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
    return res.status(500).json({ message: 'Unable to retrieve user profile.' });
  }
});

// 2. Update Profile Handler (Handles BOTH PATCH and PUT /api/auth/me)
const updateProfileHandler = async (req, res, next) => {
  try {
    const { name, phone, displayName } = req.body || {};
    const targetName = (name || displayName || '').trim();

    const [existing] = await db.execute('SELECT name, phone FROM users WHERE id = ?', [req.user.id]);
    if (existing.length === 0) return res.status(404).json({ message: 'User not found.' });

    const finalName = targetName || existing[0].name;
    const finalPhone = phone !== undefined ? (phone?.trim() || null) : existing[0].phone;

    await db.execute('UPDATE users SET name = ?, phone = ? WHERE id = ?', [finalName, finalPhone, req.user.id]);

    const [updated] = await db.execute(
      'SELECT id, name, email, phone, email_verified_at, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = updated[0];
    return res.json({
      message: 'Profile updated successfully.',
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
    next(err);
  }
};

router.patch('/me', authenticateToken, updateProfileHandler);
router.put('/me', authenticateToken, updateProfileHandler);

// 3. Saved Searches (GET, POST, DELETE /api/auth/saved-searches)
router.get('/saved-searches', authenticateToken, async (req, res) => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        query VARCHAR(255) NOT NULL,
        filters JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_searches (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await db.execute(
      'SELECT id, query, filters, created_at FROM saved_searches WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    return res.json({ savedSearches: rows || [] });
  } catch (err) {
    return res.json({ savedSearches: [] });
  }
});

router.post('/saved-searches', authenticateToken, async (req, res, next) => {
  try {
    const { query, filters } = req.body || {};
    if (!query?.trim()) return res.status(400).json({ message: 'Search query is required.' });

    await db.execute(
      'INSERT INTO saved_searches (user_id, query, filters) VALUES (?, ?, ?)',
      [req.user.id, query.trim(), filters ? JSON.stringify(filters) : null]
    );
    return res.json({ message: 'Search saved successfully.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-searches/:id', authenticateToken, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM saved_searches WHERE user_id = ? AND id = ?', [req.user.id, req.params.id]);
    return res.json({ message: 'Saved search removed.' });
  } catch (err) {
    next(err);
  }
});

// 4. Job Applications Tracker (GET & POST /api/auth/applications)
router.get('/applications', authenticateToken, async (req, res) => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        job_id VARCHAR(128) NOT NULL,
        status VARCHAR(64) NOT NULL DEFAULT 'Applied',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_apps (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await db.execute(
      'SELECT * FROM job_applications WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    return res.json({ applications: rows || [] });
  } catch (err) {
    return res.json({ applications: [] });
  }
});

router.post('/applications', authenticateToken, async (req, res, next) => {
  try {
    const { jobId, status } = req.body || {};
    if (!jobId) return res.status(400).json({ message: 'Job ID is required.' });

    await db.execute(
      'INSERT INTO job_applications (user_id, job_id, status) VALUES (?, ?, ?)',
      [req.user.id, String(jobId), status || 'Applied']
    );
    return res.json({ message: 'Application recorded successfully.' });
  } catch (err) {
    next(err);
  }
});

// 5. Saved Jobs (GET, POST, DELETE /api/auth/saved-jobs)
router.get('/saved-jobs', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT job_id FROM saved_jobs WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({ savedJobs: (rows || []).map(r => String(r.job_id)) });
  } catch (err) {
    return res.json({ savedJobs: [] });
  }
});

router.post('/saved-jobs', authenticateToken, async (req, res, next) => {
  try {
    const { jobId } = req.body || {};
    if (!jobId) return res.status(400).json({ message: 'Job ID is required.' });

    await db.execute(`
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        job_id VARCHAR(128) NOT NULL,
        UNIQUE KEY uq_user_job (user_id, job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.execute(
      'INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)',
      [req.user.id, String(jobId)]
    );
    return res.json({ message: 'Job alert saved.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-jobs/:id', authenticateToken, async (req, res, next) => {
  try {
    await db.execute(
      'DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?',
      [req.user.id, String(req.params.id)]
    );
    return res.json({ message: 'Job alert removed.' });
  } catch (err) {
    next(err);
  }
});

// 6. Saved Current Affairs / Bookmarks
router.get('/saved-affairs', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT affair_id FROM saved_affairs WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({ savedAffairs: (rows || []).map(r => String(r.affair_id)) });
  } catch (err) {
    return res.json({ savedAffairs: [] });
  }
});

// 7. Exam Plans & Quiz History Support
router.get('/exam-plans', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM exam_plans WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    return res.json({ examPlans: rows || [] });
  } catch (err) {
    return res.json({ examPlans: [] });
  }
});

router.get('/quiz-history', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    );
    return res.json({ quizAttempts: rows || [] });
  } catch (err) {
    return res.json({ quizAttempts: [] });
  }
});

// 8. Register (POST /api/auth/register)
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

// 9. Login (POST /api/auth/login) - signs with issuer and audience
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
      { 
        sub: String(user.id), 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: 'learner' 
      },
      jwtSecret,
      { 
        algorithm: 'HS256',
        issuer: 'pvgj-api', 
        audience: 'pvgj-user', 
        expiresIn: '7d' 
      }
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

// 10. Forgot Password (POST /api/auth/forgot-password)
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

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
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
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

// 11. Reset Password (POST /api/auth/reset-password)
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