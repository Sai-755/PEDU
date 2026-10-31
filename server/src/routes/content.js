
import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get published services
router.get('/services', async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, title, description, category, created_at, updated_at
      FROM services
      WHERE is_published = TRUE
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Services query failed:', error.message);
    res.status(500).json({ message: 'Unable to load services.' });
  }
});

// Get published study materials
router.get('/resources', async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, title, description, category, file_url,
             created_at, updated_at
      FROM study_materials
      WHERE is_published = TRUE
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Study materials query failed:', error.message);
    res.status(500).json({
      message: 'Unable to load study materials.'
    });
  }
});

// Get published job alerts
router.get('/jobs', async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, title, organization, description, official_url,
             last_date, created_at, updated_at
      FROM job_alerts
      WHERE is_published = TRUE
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Job alerts query failed:', error.message);
    res.status(500).json({ message: 'Unable to load job alerts.' });
  }
});

export default router;
