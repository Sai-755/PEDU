
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

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

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

app.use(express.json({ limit: '30kb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false
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
  console.log(`PVGJ API running at http://localhost:${PORT}`);
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

// auth route registered below

