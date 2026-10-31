
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

    // Always perform a password-hash comparison, even for a wrong email.
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

// Dashboard overview
router.get('/overview', async (_req, res, next) => {
  try {
    const queries = await Promise.all([
      db.execute('SELECT COUNT(*) AS total FROM guidance_enquiries'),
      db.execute('SELECT COUNT(*) AS total FROM services'),
      db.execute('SELECT COUNT(*) AS total FROM study_materials'),
      db.execute('SELECT COUNT(*) AS total FROM job_alerts'),
      db.execute(
        "SELECT COUNT(*) AS total FROM guidance_enquiries WHERE status <> 'Resolved'"
      )
    ]);

    const count = (result) => Number(result[0][0].total);

    return res.json({
      enquiries: count(queries[0]),
      services: count(queries[1]),
      resources: count(queries[2]),
      jobs: count(queries[3]),
      openEnquiries: count(queries[4]),
      database: true
    });
  } catch (error) {
    next(error);
  }
});

// List guidance enquiries
router.get('/enquiries', async (_req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, email, phone, subject, message, status, created_at
       FROM guidance_enquiries
       ORDER BY created_at DESC
       LIMIT 500`
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        status: {
          New: 'new',
          'In progress': 'in-progress',
          Resolved: 'resolved'
        }[row.status] || 'new'
      }))
    );
  } catch (error) {
    next(error);
  }
});

// Update enquiry status
router.patch('/enquiries/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;

    const statusMap = {
      new: 'New',
      'in-progress': 'In progress',
      resolved: 'Resolved'
    };

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid enquiry ID.' });
    }

    if (!Object.hasOwn(statusMap, status)) {
      return res.status(400).json({ message: 'Invalid enquiry status.' });
    }

    const [result] = await db.execute(
      'UPDATE guidance_enquiries SET status = ? WHERE id = ?',
      [statusMap[status], id]
    );

    if (result.affectedRows === 0) {
      const [existing] = await db.execute(
        'SELECT id FROM guidance_enquiries WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Enquiry not found.' });
      }
    }

    const [rows] = await db.execute(
      `SELECT id, name, email, phone, subject, message, status, created_at
       FROM guidance_enquiries WHERE id = ?`,
      [id]
    );

    const item = rows[0];

    return res.json({
      ...item,
      status: {
        New: 'new',
        'In progress': 'in-progress',
        Resolved: 'resolved'
      }[item.status] || 'new'
    });
  } catch (error) {
    next(error);
  }
});

// List content by type
router.get('/content', async (req, res, next) => {
  try {
    const kind = parseContentKind(req.query.kind);

    if (!kind) {
      return res.status(400).json({
        message: 'Select service, resource, or job.'
      });
    }

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

    const config = CONTENT_TABLES[kind];
    const data = {
      title: body.title.trim()
    };

    for (const field of config.fields) {
      if (field === 'title') continue;

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
        message: 'Provide the content kind: service, resource, or job.'
      });
    }

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
        message: 'Provide the content kind: service, resource, or job.'
      });
    }

    const config = CONTENT_TABLES[kind];
    const [result] = await db.execute(
      `DELETE FROM ${config.table} WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Content not found.' });
    }

    return res.json({ message: 'Content deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;

