import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import db from '../db.js';

const router = Router();
const coachLimiter = rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false });
let schemaReady;
async function ensureLearningTables() {
  if (!schemaReady) schemaReady = (async () => {
    await db.execute("CREATE TABLE IF NOT EXISTS exam_plans (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, name VARCHAR(140) NOT NULL, target_exam VARCHAR(140) NOT NULL DEFAULT '', exam_date DATE NULL, weekly_goal_minutes INT UNSIGNED NOT NULL DEFAULT 300, topics_json LONGTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_exam_plans_user (user_id, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await db.execute("CREATE TABLE IF NOT EXISTS quiz_attempts (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, quiz_key VARCHAR(120) NOT NULL, score SMALLINT UNSIGNED NOT NULL, total SMALLINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_quiz_attempts_user (user_id, created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await db.execute("CREATE TABLE IF NOT EXISTS learning_bookmarks (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, affair_id BIGINT UNSIGNED NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY user_affair_bookmark (user_id, affair_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await db.execute("CREATE TABLE IF NOT EXISTS job_alert_subscriptions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, keywords VARCHAR(200) NOT NULL DEFAULT '', category VARCHAR(150) NOT NULL DEFAULT '', qualification VARCHAR(120) NOT NULL DEFAULT '', location VARCHAR(120) NOT NULL DEFAULT '', job_type VARCHAR(100) NOT NULL DEFAULT '', reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY user_alert_name (user_id, name), INDEX idx_job_alert_subscriptions_user (user_id, created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  })().catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
}
function learner(req, res) {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
  if (!match || !process.env.JWT_SECRET) { res.status(401).json({ message: 'Please sign in to continue.' }); return null; }
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'pvgj-api', audience: 'pvgj-user' });
    if (payload.role !== 'learner' || !payload.sub) throw new Error('Invalid learner token');
    return payload;
  } catch { res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' }); return null; }
}
function parseTopics(value) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const topics = [];
  for (const topic of value) {
    if (!topic || typeof topic.title !== 'string' || !topic.title.trim() || topic.title.trim().length > 180) return null;
    topics.push({ id: typeof topic.id === 'string' ? topic.id.slice(0, 80) : String(Date.now()) + '-' + topics.length, title: topic.title.trim(), done: Boolean(topic.done) });
  }
  return topics;
}
function validatePlan(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const targetExam = typeof body.targetExam === 'string' ? body.targetExam.trim() : '';
  const examDate = body.examDate || null;
  const weeklyGoal = Number(body.weeklyGoalMinutes || 300);
  const topics = parseTopics(body.topics || []);
  if (!name || name.length > 140 || targetExam.length > 140) return { error: 'Add a plan name and keep it under 140 characters.' };
  if (examDate && (typeof examDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || Number.isNaN(Date.parse(examDate + 'T00:00:00Z')))) return { error: 'Choose a valid exam date.' };
  if (!Number.isInteger(weeklyGoal) || weeklyGoal < 30 || weeklyGoal > 10080) return { error: 'Weekly study goals must be between 30 minutes and 7 days.' };
  if (!topics) return { error: 'Add valid syllabus topics (up to 100).' };
  return { data: { name, targetExam, examDate, weeklyGoal, topics } };
}
router.post('/coach', coachLimiter, async (req, res, next) => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 500) : '';
    if (question.length < 3) return res.status(400).json({ message: 'Ask a question of at least 3 characters.' });
    const stop = new Set(['what','when','where','which','with','from','have','does','your','about','this','that','help','please','can','the','and','for']);
    const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].filter((word) => !stop.has(word));
    if (!terms.length) return res.json({ answer: 'Try naming a topic, exam, course, or resource so I can search the published PVGJ library.', sources: [] });
    const resultSets = await Promise.allSettled([
      db.execute("SELECT title,description AS excerpt,category,NULL AS source_url,'service' AS kind FROM services WHERE is_published=TRUE LIMIT 100"),
      db.execute("SELECT title,summary AS excerpt,NULL AS category,material_url AS source_url,'course' AS kind FROM service_courses WHERE is_published=TRUE LIMIT 200"),
      db.execute("SELECT title,description AS excerpt,category,file_url AS source_url,'material' AS kind FROM study_materials WHERE is_published=TRUE LIMIT 200"),
      db.execute("SELECT title,description AS excerpt,category,official_url AS source_url,'job alert' AS kind FROM job_alerts WHERE is_published=TRUE LIMIT 200"),
      db.execute("SELECT title,description AS excerpt,category,official_url AS source_url,'current affairs' AS kind FROM current_affairs WHERE is_published=TRUE AND (publish_at IS NULL OR publish_at<=NOW()) LIMIT 300")
    ]);
    const rows = resultSets.flatMap((item) => item.status === 'fulfilled' ? item.value[0] : []);
    const ranked = rows.map((row) => {
      const text = (row.title || '') + ' ' + (row.category || '') + ' ' + (row.excerpt || '');
      const lower = text.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? (String(row.title || '').toLowerCase().includes(term) ? 3 : 1) : 0), 0);
      return { ...row, score };
    }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    const sources = ranked.map((row) => ({ title: row.title, type: row.kind, category: row.category, excerpt: String(row.excerpt || '').slice(0, 700), url: row.source_url || '' }));
    const answer = sources.length
      ? 'I searched the published PVGJ library for "' + question + '". Here are the closest materials. Use the source links to review the full content; I only use information published in PVGJ, so confirm time-sensitive requirements against the original notice.'
      : 'I could not find a close match in the published PVGJ library yet. Try a different keyword, or ask about a course, study material, current affairs post, or job alert.';
    return res.json({ answer, sources, grounded: true });
  } catch (error) { next(error); }
});
router.use(async (req, res, next) => {
  const user = learner(req, res);
  if (!user) return;
  req.learner = user;
  try { await ensureLearningTables(); next(); } catch (error) { next(error); }
});
router.get('/plans', async (req, res, next) => {
  try {
    const [rows] = await db.execute('SELECT id,name,target_exam AS targetExam,exam_date AS examDate,weekly_goal_minutes AS weeklyGoalMinutes,topics_json AS topics,created_at AS createdAt,updated_at AS updatedAt FROM exam_plans WHERE user_id=? ORDER BY updated_at DESC LIMIT 50', [req.learner.sub]);
    return res.json({ plans: rows.map((row) => ({ ...row, topics: JSON.parse(row.topics || '[]') })) });
  } catch (error) { next(error); }
});
router.post('/plans', async (req, res, next) => {
  try {
    const validated = validatePlan(req.body); if (validated.error) return res.status(400).json({ message: validated.error });
    const d = validated.data;
    const [result] = await db.execute('INSERT INTO exam_plans(user_id,name,target_exam,exam_date,weekly_goal_minutes,topics_json) VALUES(?,?,?,?,?,?)', [req.learner.sub,d.name,d.targetExam,d.examDate,d.weeklyGoal,JSON.stringify(d.topics)]);
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (error) { next(error); }
});
router.put('/plans/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid plan ID.' });
    const validated = validatePlan(req.body); if (validated.error) return res.status(400).json({ message: validated.error });
    const d = validated.data;
    const [result] = await db.execute('UPDATE exam_plans SET name=?,target_exam=?,exam_date=?,weekly_goal_minutes=?,topics_json=? WHERE id=? AND user_id=?', [d.name,d.targetExam,d.examDate,d.weeklyGoal,JSON.stringify(d.topics),id,req.learner.sub]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Plan not found.' });
    return res.json({ id, ...d });
  } catch (error) { next(error); }
});
router.delete('/plans/:id', async (req, res, next) => {
  try { await db.execute('DELETE FROM exam_plans WHERE id=? AND user_id=?', [req.params.id,req.learner.sub]); return res.json({ deleted: true }); }
  catch (error) { next(error); }
});
router.get('/bookmarks', async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT affair_id AS id FROM learning_bookmarks WHERE user_id=?', [req.learner.sub]); return res.json({ ids: rows.map((row) => Number(row.id)) }); }
  catch (error) { next(error); }
});
router.post('/bookmarks/:affairId', async (req, res, next) => {
  try { await db.execute('INSERT IGNORE INTO learning_bookmarks(user_id,affair_id) VALUES(?,?)', [req.learner.sub,req.params.affairId]); return res.status(201).json({ saved: true }); }
  catch (error) { next(error); }
});
router.delete('/bookmarks/:affairId', async (req, res, next) => {
  try { await db.execute('DELETE FROM learning_bookmarks WHERE user_id=? AND affair_id=?', [req.learner.sub,req.params.affairId]); return res.json({ saved: false }); }
  catch (error) { next(error); }
});
router.get('/quiz-history', async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT quiz_key AS quizKey,score,total,created_at AS createdAt FROM quiz_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 30', [req.learner.sub]); return res.json({ attempts: rows }); }
  catch (error) { next(error); }
});
router.post('/quiz-attempts', async (req, res, next) => {
  try {
    const { quizKey, score, total } = req.body || {};
    if (typeof quizKey !== 'string' || !quizKey || quizKey.length > 120 || !Number.isInteger(score) || !Number.isInteger(total) || total < 1 || total > 100 || score < 0 || score > total) return res.status(400).json({ message: 'Invalid quiz result.' });
    await db.execute('INSERT INTO quiz_attempts(user_id,quiz_key,score,total) VALUES(?,?,?,?)', [req.learner.sub,quizKey,score,total]);
    return res.status(201).json({ saved: true });
  } catch (error) { next(error); }
});
router.get('/alerts', async (req, res, next) => {
  try { const [rows] = await db.execute('SELECT id,name,keywords,category,qualification,location,job_type AS jobType,reminder_enabled AS reminderEnabled,created_at AS createdAt FROM job_alert_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.learner.sub]); return res.json({ alerts: rows.map((row) => ({ ...row, reminderEnabled: Boolean(row.reminderEnabled) })) }); }
  catch (error) { next(error); }
});
router.post('/alerts', async (req, res, next) => {
  try {
    const { name,keywords='',category='',qualification='',location='',jobType='',reminderEnabled=true } = req.body || {};
    const fields = [[name,120,'name',true],[keywords,200,'keywords'],[category,150,'category'],[qualification,120,'qualification'],[location,120,'location'],[jobType,100,'job type']];
    for (const [value,max,label,required] of fields) if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) return res.status(400).json({ message: 'Enter a valid alert ' + label + '.' });
    if (![true,false,0,1].includes(reminderEnabled)) return res.status(400).json({ message: 'Choose whether in-app reminders are enabled.' });
    if (![keywords,category,qualification,location,jobType].some((item) => item.trim())) return res.status(400).json({ message: 'Add at least one alert filter.' });
    const [result] = await db.execute('INSERT INTO job_alert_subscriptions(user_id,name,keywords,category,qualification,location,job_type,reminder_enabled) VALUES(?,?,?,?,?,?,?,?)', [req.learner.sub,name.trim(),keywords.trim(),category.trim(),qualification.trim(),location.trim(),jobType.trim(),reminderEnabled ? 1 : 0]);
    return res.status(201).json({ id: result.insertId, saved: true });
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An alert with that name already exists.' }); next(error); }
});
router.delete('/alerts/:id', async (req, res, next) => {
  try { await db.execute('DELETE FROM job_alert_subscriptions WHERE id=? AND user_id=?', [req.params.id,req.learner.sub]); return res.json({ deleted: true }); }
  catch (error) { next(error); }
});
export default router;
