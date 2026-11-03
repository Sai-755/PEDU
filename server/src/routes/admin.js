import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../middleware/adminAuth.js';
import db from '../db.js';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again in 15 minutes.'
  }
});

const CONTENT_TABLES = {
  service: {
    table: 'services',
    fields: ['title', 'description', 'category', 'is_published'],
    urlField: null
  },
  resource: {
    table: 'study_materials',
    fields: ['title', 'description', 'category', 'file_url', 'is_published'],
    urlField: 'file_url'
  },
  affair: {
    table: 'current_affairs',
    fields: ['title', 'description', 'category', 'official_url', 'is_published', 'publish_at'],
    urlField: 'official_url'
  },
  job: {
    table: 'job_alerts',
    fields: [
      'title',
      'organization',
      'description',
      'official_url',
      'last_date',
      'is_published'
    ],
    urlField: 'official_url'
  }
};

function parseContentKind(value) {
  return typeof value === 'string' && CONTENT_TABLES[value]
    ? value
    : null;
}

function validateUrl(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateDate(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizePublishAt(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 32 || Number.isNaN(Date.parse(value))) return undefined;
  return value.replace('T', ' ').slice(0, 19);
}

function normalizePublished(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return 1;
  }

  if (value === false || value === 0 || value === '0' || value === 'false') {
    return 0;
  }

  return null;
}

// Admin login
router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminEmail || !passwordHash || !jwtSecret) {
      return res.status(503).json({
        message: 'Admin security configuration is incomplete.'
      });
    }

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        message: 'Enter a valid email and password.'
      });
    }

    const emailMatches =
      email.trim().toLowerCase() === adminEmail.trim().toLowerCase();

    const passwordMatches = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({
        message: 'Incorrect email or password.'
      });
    }

    const token = jwt.sign(
      {
        role: 'admin',
        email: adminEmail
      },
      jwtSecret,
      {
        expiresIn: '15m',
        issuer: 'pvgj-api',
        audience: 'pvgj-admin'
      }
    );

    res.set('Cache-Control', 'no-store');

    return res.json({
      token,
      email: adminEmail,
      expiresIn: 900
    });
  } catch (error) {
    console.error('Admin login failed:', error.message);

    return res.status(500).json({
      message: 'Unable to sign in right now.'
    });
  }
});

// Every route below this point requires a valid admin JWT.
router.use(requireAdmin);

let adminTablesReady;
async function ensureAdminToolsTables() {
  if (!adminTablesReady) {
    adminTablesReady = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS contact_queries (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(254) NOT NULL,
          subject VARCHAR(200) NULL,
          message TEXT NOT NULL,
          admin_reply TEXT NULL,
          status ENUM('pending', 'replied') NOT NULL DEFAULT 'pending',
          replied_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await db.execute("CREATE TABLE IF NOT EXISTS current_affairs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, description LONGTEXT NULL, category VARCHAR(100) NULL, official_url VARCHAR(2048) NULL, published_at DATE NULL, publish_at DATETIME NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_current_affairs_publish (is_published,publish_at,published_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
      await db.execute("CREATE TABLE IF NOT EXISTS admin_audit_log (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, admin_email VARCHAR(254) NOT NULL, action VARCHAR(40) NOT NULL, content_kind VARCHAR(40) NOT NULL, content_id BIGINT NULL, title VARCHAR(200) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_admin_audit_time (created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    })().catch((error) => {
      adminTablesReady = null;
      throw error;
    });
  }
  await adminTablesReady;
}

async function writeAudit(req, action, kind, id, title) {
  try {
    await ensureAdminToolsTables();
    await db.execute(
      'INSERT INTO admin_audit_log(admin_email,action,content_kind,content_id,title) VALUES(?,?,?,?,?)',
      [req.admin?.email || 'admin', action, kind, id || null, String(title || '').slice(0, 200) || null]
    );
  } catch (error) {
    console.error('Could not record admin audit event:', error.message);
  }
}

const defaultServices = [
  ['Technical Skills & Knowledge', 'Build practical skills through programming, web development, AI, data science, and guided projects.', 'Learn'],
  ['Current Affairs', 'Stay up to date with national and international developments, government schemes, and exam-focused news.', 'Stay informed'],
  ['General Knowledge', 'Strengthen your foundation in history, geography, polity, economics, and science.', 'Build knowledge'],
  ['Job Alerts', 'Explore recruitment announcements, eligibility details, important dates, and official application information.', 'Find opportunities'],
  ['Study Materials', 'Find organized notes, revision sheets, practice worksheets, and previous-year question papers.', 'Study smarter'],
  ['Government Exam Preparation', 'Prepare with exam roadmaps, syllabus breakdowns, mock tests, and explained answers.', 'Prepare with purpose'],
  ['Guidance & Mentorship', 'Get direction on education choices, career paths, exam strategy, resumes, and interviews.', 'Move forward']
];

let defaultServicesReady;
async function ensureDefaultServices() {
  if (!defaultServicesReady) defaultServicesReady = (async () => {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM services');
    if (Number(rows[0].total) > 0) return;
    for (const [title, description, category] of defaultServices) {
      await db.execute('INSERT INTO services (title, description, category, is_published) VALUES (?, ?, ?, TRUE)', [title, description, category]);
    }
  })().catch((error) => { defaultServicesReady = null; throw error; });
  await defaultServicesReady;
}

let serviceCoursesReady;
async function ensureServiceCourses() {
  if (!serviceCoursesReady) {
    serviceCoursesReady = (async () => {
      await db.execute('CREATE TABLE IF NOT EXISTS service_courses (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, service_id BIGINT UNSIGNED NOT NULL, title VARCHAR(200) NOT NULL, summary TEXT NULL, details LONGTEXT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0.00, duration VARCHAR(120) NULL, course_level VARCHAR(100) NULL, material_url VARCHAR(2048) NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_service_courses_service (service_id, is_published)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    })().catch((error) => {
      serviceCoursesReady = null;
      throw error;
    });
  }
  await serviceCoursesReady;
}

function courseData(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const priceText = body.price === undefined || body.price === null || body.price === '' ? '0' : String(body.price);
  const price = Number(priceText);
  if (!title || title.length > 200) return { error: 'Enter a course title of up to 200 characters.' };
  if (!/^(?:\d{1,8})(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price > 99999999.99) return { error: 'Enter a valid course price in INR.' };
  for (const [field, max, label] of [['summary', 2000, 'Summary'], ['details', 30000, 'Course details'], ['duration', 120, 'Duration'], ['courseLevel', 100, 'Course level']]) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > max)) return { error: label + ' is too long.' };
  }
  const materialUrl = body.materialUrl || '';
  if (!validateUrl(materialUrl)) return { error: 'Course material links must use http:// or https://.' };
  const published = body.isPublished === undefined ? 1 : normalizePublished(body.isPublished);
  if (published === null) return { error: 'Choose whether this course is published.' };
  return { data: { title, summary: (body.summary || '').trim() || null, details: (body.details || '').trim() || null, price, duration: (body.duration || '').trim() || null, courseLevel: (body.courseLevel || '').trim() || null, materialUrl: materialUrl || null, isPublished: published } };
}

function presentCourse(row) {
  return { ...row, price: Number(row.price), courseLevel: row.course_level, materialUrl: row.material_url, isPublished: Boolean(row.is_published) };
}

// Service Courses Routes
router.get('/services/:serviceId/courses', async (req, res, next) => {
  try {
    const serviceId = Number(req.params.serviceId);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1) return res.status(400).json({ message: 'Invalid service ID.' });
    await ensureServiceCourses();
    const [rows] = await db.execute('SELECT id, service_id, title, summary, details, price, duration, course_level, material_url, is_published, created_at FROM service_courses WHERE service_id = ? ORDER BY created_at DESC', [serviceId]);
    return res.json(rows.map(presentCourse));
  } catch (error) { next(error); }
});

router.post('/services/:serviceId/courses', async (req, res, next) => {
  try {
    const serviceId = Number(req.params.serviceId);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1) return res.status(400).json({ message: 'Invalid service ID.' });
    const parsed = courseData(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    await ensureServiceCourses();
    const d = parsed.data;
    const [result] = await db.execute('INSERT INTO service_courses (service_id, title, summary, details, price, duration, course_level, material_url, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [serviceId, d.title, d.summary, d.details, d.price, d.duration, d.courseLevel, d.materialUrl, d.isPublished]);
    const [rows] = await db.execute('SELECT id, service_id, title, summary, details, price, duration, course_level, material_url, is_published, created_at FROM service_courses WHERE id = ?', [result.insertId]);
    return res.status(201).json(presentCourse(rows[0]));
  } catch (error) { next(error); }
});

router.put('/services/:serviceId/courses/:courseId', async (req, res, next) => {
  try {
    const serviceId = Number(req.params.serviceId), courseId = Number(req.params.courseId);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1 || !Number.isSafeInteger(courseId) || courseId < 1) return res.status(400).json({ message: 'Invalid course or service ID.' });
    const parsed = courseData(req.body || {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    await ensureServiceCourses();
    const d = parsed.data;
    const [result] = await db.execute('UPDATE service_courses SET title=?, summary=?, details=?, price=?, duration=?, course_level=?, material_url=?, is_published=? WHERE id=? AND service_id=?', [d.title, d.summary, d.details, d.price, d.duration, d.courseLevel, d.materialUrl, d.isPublished, courseId, serviceId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Course not found in this service.' });
    const [rows] = await db.execute('SELECT id, service_id, title, summary, details, price, duration, course_level, material_url, is_published, created_at FROM service_courses WHERE id=?', [courseId]);
    return res.json(presentCourse(rows[0]));
  } catch (error) { next(error); }
});

router.delete('/services/:serviceId/courses/:courseId', async (req, res, next) => {
  try {
    const serviceId = Number(req.params.serviceId), courseId = Number(req.params.courseId);
    if (!Number.isSafeInteger(serviceId) || serviceId < 1 || !Number.isSafeInteger(courseId) || courseId < 1) return res.status(400).json({ message: 'Invalid course or service ID.' });
    await ensureServiceCourses();
    const [result] = await db.execute('DELETE FROM service_courses WHERE id=? AND service_id=?', [courseId, serviceId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Course not found in this service.' });
    return res.json({ deleted: true });
  } catch (error) { next(error); }
});

// Learner management and administration audit trail
router.get('/learners', async (req, res, next) => {
  try {
    const [cols] = await db.execute("SHOW COLUMNS FROM users LIKE 'phone'");
    if (!cols.length) await db.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER email');
    const [rows] = await db.execute('SELECT id,name,email,phone,email_verified_at AS emailVerifiedAt,created_at AS createdAt FROM users ORDER BY created_at DESC LIMIT 500');
    return res.json({ learners: rows.map((row) => ({ ...row, emailVerified: Boolean(row.emailVerifiedAt) })) });
  } catch (error) { next(error); }
});

router.get('/audit-log', async (_req, res, next) => {
  try {
    await ensureAdminToolsTables();
    const [rows] = await db.execute('SELECT id,admin_email AS adminEmail,action,content_kind AS contentKind,content_id AS contentId,title,created_at AS createdAt FROM admin_audit_log ORDER BY created_at DESC LIMIT 250');
    return res.json({ entries: rows });
  } catch (error) { next(error); }
});

// Bulk content import
router.post('/content/bulk', async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const kind = parseContentKind(req.body?.kind);
    const items = req.body?.items;
    if (!kind || !Array.isArray(items) || !items.length || items.length > 200) return res.status(400).json({ message: 'Choose a content type and provide 1 to 200 JSON records.' });
    if (kind === 'affair') await ensureAdminToolsTables();
    const config = CONTENT_TABLES[kind];
    await connection.beginTransaction();
    for (const item of items) {
      if (!item || typeof item.title !== 'string' || !item.title.trim() || item.title.trim().length > 200) throw Object.assign(new Error('Each record needs a title of up to 200 characters.'), { status: 400 });
      const data = { title: item.title.trim() };
      for (const field of config.fields) {
        if (field === 'title') continue;
        if (field === 'is_published') {
          const published = item[field] === undefined ? 0 : normalizePublished(item[field]);
          if (published === null) throw Object.assign(new Error('A record has an invalid publish status.'), { status: 400 });
          data[field] = published;
        } else if (field === 'publish_at') {
          const scheduled = normalizePublishAt(item[field]);
          if (scheduled === undefined) throw Object.assign(new Error('A record has an invalid publish date.'), { status: 400 });
          data[field] = scheduled;
        } else if (field === config.urlField) {
          if (!validateUrl(item[field])) throw Object.assign(new Error('Links must use a valid http:// or https:// URL.'), { status: 400 });
          data[field] = typeof item[field] === 'string' ? item[field] : null;
        } else if (field === 'last_date') {
          if (!validateDate(item[field])) throw Object.assign(new Error('Job closing dates must use YYYY-MM-DD format.'), { status: 400 });
          data[field] = item[field] || null;
        } else {
          if (item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string') throw Object.assign(new Error('A record contains an invalid text field.'), { status: 400 });
          data[field] = typeof item[field] === 'string' ? item[field].trim() || null : null;
        }
      }
      const fields = Object.keys(data);
      await connection.execute('INSERT INTO ' + config.table + ' (' + fields.map((field) => '`' + field + '`').join(',') + ') VALUES (' + fields.map(() => '?').join(',') + ')', fields.map((field) => data[field]));
    }
    await connection.commit();
    await writeAudit(req, 'bulk imported ' + items.length, kind, null, 'Bulk content import');
    return res.status(201).json({ imported: items.length });
  } catch (error) {
    await connection.rollback();
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  } finally { connection.release(); }
});

// Dashboard overview
router.get('/overview', async (_req, res, next) => {
  try {
    await ensureAdminToolsTables();
    await ensureServiceCourses();
    const queries = await Promise.all([
      db.execute('SELECT COUNT(*) AS total FROM contact_queries'),
      db.execute('SELECT COUNT(*) AS total FROM services'),
      db.execute('SELECT COUNT(*) AS total FROM study_materials'),
      db.execute('SELECT COUNT(*) AS total FROM job_alerts'),
      db.execute('SELECT COUNT(*) AS total FROM users'),
      db.execute('SELECT COUNT(*) AS total FROM current_affairs'),
      db.execute('SELECT COUNT(*) AS total FROM service_courses'),
      db.execute("SELECT COUNT(*) AS total FROM contact_queries WHERE status = 'pending'")
    ]);

    const count = (result) => Number(result[0][0].total);

    return res.json({
      enquiries: count(queries[0]),
      services: count(queries[1]),
      resources: count(queries[2]),
      jobs: count(queries[3]),
      learners: count(queries[4]),
      currentAffairs: count(queries[5]),
      courses: count(queries[6]),
      openEnquiries: count(queries[7]),
      database: true
    });
  } catch (error) {
    next(error);
  }
});

// List contact and guidance queries (Talk to PVGJ)
router.get('/queries', async (_req, res, next) => {
  try {
    await ensureAdminToolsTables();
    const [queries] = await db.execute(
      `SELECT id, name, email, subject, message, admin_reply, status, replied_at, created_at 
       FROM contact_queries 
       ORDER BY created_at DESC 
       LIMIT 500`
    );
    return res.json({ queries });
  } catch (error) {
    console.error('[ADMIN GET QUERIES ERROR]:', error.message);
    next(error);
  }
});

// Reply to contact query via Brevo REST API
router.post('/queries/:id/reply', async (req, res, next) => {
  try {
    await ensureAdminToolsTables();
    const id = Number(req.params.id);
    const { replyMessage } = req.body || {};

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid query ID.' });
    }

    if (!replyMessage || typeof replyMessage !== 'string' || !replyMessage.trim()) {
      return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    const [rows] = await db.execute(
      'SELECT email, name, subject, message FROM contact_queries WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Inquiry not found.' });
    }

    const query = rows[0];
    const apiKey = process.env.BREVO_API_KEY || process.env.BREVO_KEY;
    const rawFrom = process.env.EMAIL_FROM || 'pvgjeducation@gmail.com';
    const fromEmail = (rawFrom.match(/<([^>]+)>/) ? rawFrom.match(/<([^>]+)>/)[1] : rawFrom).trim();

    if (!apiKey) {
      return res.status(503).json({ message: 'Email service is not configured. Missing BREVO_API_KEY.' });
    }

    const emailPayload = {
      sender: { name: 'PVGJ Support', email: fromEmail },
      to: [{ email: query.email, name: query.name }],
      replyTo: { email: fromEmail, name: 'PVGJ Support' },
      subject: `Response to your inquiry: ${query.subject || 'Talk to PVGJ'}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #173b2d; max-width: 600px; margin: auto; border: 1px solid #e1e8df; border-radius: 12px;">
          <h2 style="color: #173b2d; margin-top: 0;">PVGJ Support</h2>
          <p>Dear ${query.name},</p>
          <p>Thank you for reaching out to us. Here is the response to your inquiry:</p>
          <div style="background-color: #f4f6f1; border-left: 4px solid #173b2d; padding: 16px; margin: 20px 0; border-radius: 4px; line-height: 1.6; color: #173b2d;">
            ${replyMessage.trim().replace(/\n/g, '<br/>')}
          </div>
          <hr style="border: 0; border-top: 1px solid #e1e8df; margin: 24px 0;" />
          <p style="font-size: 13px; color: #666; margin-bottom: 4px;"><strong>Your Original Message:</strong></p>
          <blockquote style="font-size: 13px; color: #777; margin: 0; padding-left: 12px; border-left: 2px solid #ccc;">
            ${query.message.replace(/\n/g, '<br/>')}
          </blockquote>
          <p style="font-size: 11px; color: #999; margin-top: 24px;">You can reply directly to this email if you have additional questions.</p>
        </div>
      `
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[BREVO REPLY ERROR]:', response.status, errText);
      throw new Error(`Brevo HTTP error: ${response.status} - ${errText}`);
    }

    await db.execute(
      `UPDATE contact_queries 
       SET admin_reply = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [replyMessage.trim(), id]
    );

    await writeAudit(req, 'replied to inquiry', 'inquiry', id, query.subject || query.name);

    return res.json({ success: true, message: 'Response sent successfully.' });
  } catch (error) {
    console.error('[ADMIN REPLY HANDLER ERROR]:', error.message);
    next(error);
  }
});

// List content by type
router.get('/content', async (req, res, next) => {
  try {
    const kind = parseContentKind(req.query.kind);

    if (!kind) {
      return res.status(400).json({
        message: 'Select service, resource, job, or current affairs.'
      });
    }

    if (kind === 'service') await ensureDefaultServices();
    if (kind === 'affair') await ensureAdminToolsTables();
    const config = CONTENT_TABLES[kind];
    const [rows] = await db.execute(
      `SELECT * FROM ${config.table} ORDER BY created_at DESC LIMIT 500`
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        kind,
        url: config.urlField ? row[config.urlField] : null,
        is_published: Boolean(row.is_published)
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Create content
router.post('/content', async (req, res, next) => {
  try {
    const body = req.body || {};
    const kind = parseContentKind(body.kind);

    if (!kind) {
      return res.status(400).json({
        message: 'Invalid content type.'
      });
    }

    if (
      typeof body.title !== 'string' ||
      !body.title.trim() ||
      body.title.trim().length > 200
    ) {
      return res.status(400).json({
        message: 'A title of up to 200 characters is required.'
      });
    }

    if (kind === 'affair') await ensureAdminToolsTables();
    const config = CONTENT_TABLES[kind];
    const data = {
      title: body.title.trim()
    };

    for (const field of config.fields) {
      if (field === 'title') continue;

      if (field === 'publish_at') {
        const scheduled = normalizePublishAt(body.publish_at);
        if (scheduled === undefined) return res.status(400).json({ message: 'Choose a valid publication date and time.' });
        data[field] = scheduled;
        continue;
      }

      if (field === 'is_published') {
        const published = body[field] === undefined
          ? 1
          : normalizePublished(body[field]);

        if (published === null) {
          return res.status(400).json({
            message: 'Invalid published status.'
          });
        }

        data[field] = published;
        continue;
      }

      if (field === config.urlField && !validateUrl(body[field])) {
        return res.status(400).json({
          message: 'Links must use a valid http:// or https:// URL.'
        });
      }
      if (field === 'last_date' && !validateDate(body[field])) {
        return res.status(400).json({
          message: 'The application last date must use YYYY-MM-DD format.'
        });
      }

      if (body[field] !== undefined && body[field] !== null) {
        if (typeof body[field] !== 'string') {
          return res.status(400).json({
            message: `Invalid value for ${field}.`
          });
        }

        data[field] = body[field].trim() || null;
      } else {
        data[field] = null;
      }
    }

    if (
      data.category && data.category.length > 100
    ) {
      return res.status(400).json({
        message: 'Category cannot exceed 100 characters.'
      });
    }

    for (const field of ['organization']) {
      if (data[field] && data[field].length > 200) {
        return res.status(400).json({
          message: `${field} cannot exceed 200 characters.`
        });
      }
    }

    const fields = Object.keys(data);
    const columns = fields.map((field) => `\`${field}\``).join(', ');
    const placeholders = fields.map(() => '?').join(', ');

    const [result] = await db.execute(
      `INSERT INTO ${config.table} (${columns}) VALUES (${placeholders})`,
      fields.map((field) => data[field])
    );

    const [rows] = await db.execute(
      `SELECT * FROM ${config.table} WHERE id = ?`,
      [result.insertId]
    );

    await writeAudit(req, 'created', kind, result.insertId, rows[0].title);
    return res.status(201).json({
      ...rows[0],
      kind,
      url: config.urlField ? rows[0][config.urlField] : null,
      is_published: Boolean(rows[0].is_published)
    });
  } catch (error) {
    next(error);
  }
});

// Edit content
router.put('/content/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const kind = parseContentKind(req.body?.kind || req.query.kind);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid content ID.' });
    }

    if (!kind) {
      return res.status(400).json({
        message: 'Provide a valid content kind.'
      });
    }

    if (kind === 'affair') await ensureAdminToolsTables();
    const config = CONTENT_TABLES[kind];
    const body = req.body || {};
    const data = {};

    for (const field of config.fields) {
      if (body[field] === undefined) continue;

      if (field === 'title') {
        if (
          typeof body.title !== 'string' ||
          !body.title.trim() ||
          body.title.trim().length > 200
        ) {
          return res.status(400).json({ message: 'Invalid title.' });
        }

        data.title = body.title.trim();
      } else if (field === 'publish_at') {
        const scheduled = normalizePublishAt(body.publish_at);
        if (scheduled === undefined) return res.status(400).json({ message: 'Choose a valid publication date and time.' });
        data[field] = scheduled;
      } else if (field === 'is_published') {
        const published = normalizePublished(body.is_published);

        if (published === null) {
          return res.status(400).json({
            message: 'Invalid published status.'
          });
        }

        data.is_published = published;
      } else if (field === 'last_date') {
        if (!validateDate(body[field])) {
          return res.status(400).json({
            message: 'The application last date must use YYYY-MM-DD format.'
          });
        }

        data.last_date = body[field] || null;
      } else if (field === config.urlField) {
        if (!validateUrl(body[field])) {
          return res.status(400).json({
            message: 'Links must use a valid http:// or https:// URL.'
          });
        }

        data[field] = body[field] || null;
      } else {
        if (body[field] !== null && typeof body[field] !== 'string') {
          return res.status(400).json({
            message: `Invalid value for ${field}.`
          });
        }

        data[field] = typeof body[field] === 'string'
          ? body[field].trim() || null
          : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: 'No editable fields were provided.'
      });
    }

    const fields = Object.keys(data);
    const assignments = fields.map((field) => `\`${field}\` = ?`).join(', ');

    const [result] = await db.execute(
      `UPDATE ${config.table} SET ${assignments} WHERE id = ?`,
      [...fields.map((field) => data[field]), id]
    );

    const [rows] = await db.execute(
      `SELECT * FROM ${config.table} WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Content not found.' });
    }

    await writeAudit(req, 'updated', kind, id, rows[0].title);
    return res.json({
      ...rows[0],
      kind,
      url: config.urlField ? rows[0][config.urlField] : null,
      is_published: Boolean(rows[0].is_published)
    });
  } catch (error) {
    next(error);
  }
});

// Delete content
router.delete('/content/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const kind = parseContentKind(req.query.kind || req.body?.kind);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid content ID.' });
    }

    if (!kind) {
      return res.status(400).json({
        message: 'Provide a valid content kind.'
      });
    }

    if (kind === 'affair') await ensureAdminToolsTables();
    const config = CONTENT_TABLES[kind];
    const [result] = await db.execute(
      `DELETE FROM ${config.table} WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Content not found.' });
    }

    await writeAudit(req, 'deleted', kind, id, 'Content entry');
    return res.json({ message: 'Content deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;