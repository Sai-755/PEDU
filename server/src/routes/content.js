
import { Router } from 'express';
import db from '../db.js';

const router = Router();
const slugify = (value) => { const title = String(value || '').toLowerCase().trim(); const known = { 'technical skills & knowledge': 'technical-skills', 'government exam preparation': 'government-exams', 'guidance & mentorship': 'guidance' }; return known[title] || title.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
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
    for (const [title, description, category] of defaultServices) await db.execute('INSERT INTO services (title, description, category, is_published) VALUES (?, ?, ?, TRUE)', [title, description, category]);
  })().catch((error) => { defaultServicesReady = null; throw error; });
  await defaultServicesReady;
}
let courseSchemaReady;
async function ensureCourseTable() {
  if (!courseSchemaReady) courseSchemaReady = db.execute('CREATE TABLE IF NOT EXISTS service_courses (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, service_id BIGINT UNSIGNED NOT NULL, title VARCHAR(200) NOT NULL, summary TEXT NULL, details LONGTEXT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0.00, duration VARCHAR(120) NULL, course_level VARCHAR(100) NULL, material_url VARCHAR(2048) NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_service_courses_service (service_id, is_published)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci').catch((error) => { courseSchemaReady = null; throw error; });
  await courseSchemaReady;
}

let affairsSchemaReady;
async function ensureAffairsTable() {
  if (!affairsSchemaReady) affairsSchemaReady = db.execute("CREATE TABLE IF NOT EXISTS current_affairs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, description LONGTEXT NULL, category VARCHAR(100) NULL, official_url VARCHAR(2048) NULL, published_at DATE NULL, publish_at DATETIME NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_current_affairs_publish (is_published,publish_at,published_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci").catch((error) => { affairsSchemaReady = null; throw error; });
  await affairsSchemaReady;
}
// Get published services
router.get('/services', async (_req, res) => {
  try {
    await ensureDefaultServices();
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

router.get('/services/:slug/courses', async (req, res) => {
  try {
    await ensureCourseTable();
    await ensureDefaultServices();
    const [services] = await db.execute('SELECT id, title, description, category FROM services WHERE is_published = TRUE');
    const service = services.find((item) => slugify(item.title) === req.params.slug);
    if (!service) return res.status(404).json({ message: 'This service page was not found.' });
    const [courses] = await db.execute('SELECT id, title, summary, details, price, duration, course_level AS courseLevel, material_url AS materialUrl FROM service_courses WHERE service_id = ? AND is_published = TRUE ORDER BY created_at DESC', [service.id]);
    return res.json({ service: { ...service, slug: slugify(service.title) }, courses });
  } catch (error) {
    console.error('Service courses query failed:', error.message);
    return res.status(500).json({ message: 'Unable to load this service right now.' });
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

router.get('/current-affairs', async (req, res, next) => {
  try {
    await ensureAffairsTable();
    const category = typeof req.query.category === 'string' ? req.query.category.slice(0,100) : '';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [rows] = await db.execute('SELECT id,title,description,category,official_url AS officialUrl,published_at AS publishedAt,created_at AS createdAt FROM current_affairs WHERE is_published=TRUE AND (publish_at IS NULL OR publish_at<=NOW()) AND (?=\'\' OR category=?) ORDER BY COALESCE(published_at,DATE(created_at)) DESC, id DESC LIMIT ?', [category,category,limit]);
    return res.json({ items: rows });
  } catch (error) { next(error); }
});
router.get('/current-affairs/:id', async (req, res, next) => {
  try {
    await ensureAffairsTable();
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid current-affairs entry.' });
    const [rows] = await db.execute('SELECT id,title,description,category,official_url AS officialUrl,published_at AS publishedAt,created_at AS createdAt FROM current_affairs WHERE id=? AND is_published=TRUE AND (publish_at IS NULL OR publish_at<=NOW())', [id]);
    if (!rows.length) return res.status(404).json({ message: 'This current-affairs post is not available.' });
    return res.json({ item: rows[0] });
  } catch (error) { next(error); }
});
export default router;
