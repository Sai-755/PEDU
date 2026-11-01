import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import db from './db.js';
import contentRouter from './routes/content.js';
import guidanceRouter from './routes/guidance.js';
import adminRouter from './routes/admin.js';
import externalJobsRouter from './routes/externalJobs.js';
import authRouter from './routes/auth.js';
import learningRouter from './routes/learning.js';

const app = express();
const PORT = process.env.PORT || 5000;
const trustProxyHops = process.env.TRUST_PROXY_HOPS;
if (trustProxyHops) {
  const hops = Number(trustProxyHops);
  if (!Number.isInteger(hops) || hops < 1) throw new Error('TRUST_PROXY_HOPS must be a positive integer.');
  app.set('trust proxy', hops);
}

if (process.env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'BREVO_API_KEY', 'EMAIL_FROM'];
  const missing = required.filter((key) => !process.env[key] || /replace-with|yourdomain\.com|example\.com/i.test(process.env[key]));
  const invalid = [];
  try {
    const apiUrl = new URL(process.env.API_BASE_URL || '');
    if (apiUrl.protocol !== 'https:' || !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api') || /localhost|yourdomain\.com/i.test(apiUrl.hostname)) invalid.push('API_BASE_URL');
  } catch { invalid.push('API_BASE_URL'); }
  const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || /localhost|yourdomain\.com/i.test(url.hostname) || (url.pathname !== '/' && url.pathname !== ''); }
    catch { return true; }
  })) invalid.push('CLIENT_ORIGIN');
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) invalid.push('JWT_SECRET (use at least 32 characters)');
  if (process.env.ADMIN_PASSWORD_HASH && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(process.env.ADMIN_PASSWORD_HASH)) invalid.push('ADMIN_PASSWORD_HASH (must be a bcrypt hash)');
  const issues = [...missing.map((key) => key + ' is required'), ...invalid.map((key) => key + ' is invalid')];
  if (issues.length) throw new Error('Production configuration is incomplete: ' + issues.join('; '));
}

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => { try { return new URL(origin).origin; } catch { return origin; } });

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  }
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ message: 'The PVGJ API is busy. Please wait briefly, then try again.' })
}));

// Check the MySQL database.
let databaseConnected = false;

try {
  const connection = await db.getConnection();
  await connection.ping();
  connection.release();

  databaseConnected = true;
  console.log('MySQL connected');
} catch (error) {
  console.error('MySQL connection failed:', error.message);
}

// Health endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    databaseConnected = true;

    return res.json({
      ok: true,
      service: 'PVGJ API',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    databaseConnected = false;

    return res.status(503).json({
      ok: false,
      service: 'PVGJ API',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api/content', contentRouter);
app.use('/api/auth', authRouter);
app.use('/api/learning', learningRouter);
app.use('/api/guidance', guidanceRouter);
app.use('/api/admin', adminRouter);
app.use('/api/external-jobs', externalJobsRouter);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.path}`
  });
});

// Error handling
app.use((err, _req, res, _next) => {
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({
      message: 'This origin is not allowed.'
    });
  }

  console.error(err);

  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Unexpected server error.'
  });
});

const server = app.listen(PORT, () => {
  console.log(`PVGJ API listening on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down PVGJ API...');

  server.close(async () => {
    try {
      await db.end();
    } catch (error) {
      console.error('Error closing MySQL pool:', error.message);
    }

    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);