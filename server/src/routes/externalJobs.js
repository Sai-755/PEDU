import express from 'express';
import Parser from 'rss-parser';

const router = express.Router();
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'PVGJ-Educational-Institutions/1.0 (RSS reader)' },
  customFields: { item: [['content:encoded', 'contentEncoded'], ['dc:creator', 'creator']] }
});
const FEEDS = [{ name: 'FreeJobAlert', url: 'https://www.freejobalert.com/feed/' }];
const CACHE_MS = 5 * 60 * 1000;
const DETAIL_CACHE_MS = 10 * 60 * 1000;
let cached = { at: 0, jobs: [], errors: [] };
const detailCache = new Map();
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const allowedTags = new Set(['article','section','div','p','h2','h3','h4','h5','ul','ol','li','strong','b','em','i','a','table','thead','tbody','tfoot','tr','th','td','br','hr','blockquote']);

function plainText(value = '') {
  return String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}

function classify(text) {
  const t = text.toLowerCase();
  const rules = [
    ['Banking', /\b(bank|ibps|sbi|rbi|nabard|clerk|probationary officer|po)\b/], ['Railway', /\b(railway|rrb|rrc|ntpc|locopilot|locomotive|technician)\b/],
    ['SSC & Staff Selection', /\b(ssc|staff selection|cgl|chsl|mts|stenographer)\b/], ['UPSC & Civil Services', /\b(upsc|civil services|ias|ips|ifs|nda|cds)\b/],
    ['Police & Defence', /\b(police|constable|army|navy|air force|crpf|bsf|cisf|defence|defense|agniveer)\b/], ['Teaching & Education', /\b(teacher|teaching|school|university|professor|lecturer|faculty|tgt|pgt|tet|ctet|assistant professor)\b/],
    ['Healthcare', /\b(nurse|nursing|medical|doctor|pharmacist|hospital|aiims|health|technician\s*\(medical\))\b/], ['Engineering & IT', /\b(engineer|engineering|software|developer|programmer|computer|information technology|it officer|data analyst|scientist)\b/],
    ['Apprenticeship & Internship', /\b(apprentice|apprenticeship|intern|internship|trainee)\b/], ['State Government', /\b(state government|psc|public service commission|village secretary|gram sachiv|patwari|revenue department)\b/],
    ['Admissions & Entrance', /\b(admission|entrance exam|neet|jee|counselling|counseling)\b/]
  ];
  for (const [category, pattern] of rules) if (pattern.test(t)) return category;
  return 'Other Government & Public Jobs';
}

function normalize(item, source) {
  const title = plainText(item.title || 'Job alert');
  const description = plainText(item.contentEncoded || item.content || item['content:encoded'] || item.contentSnippet || item.summary || item.description || '');
  const sourceUrl = item.link || item.guid || '';
  const publishedAt = item.isoDate || item.pubDate || item.date || null;
  return {
    id: Buffer.from(sourceUrl || title).toString('base64url'), title,
    description: description.length > 440 ? `${description.slice(0, 437).trimEnd()}…` : description,
    publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null,
    source, sourceUrl, category: classify(`${title} ${description}`)
  };
}

function extractClassBlock(html, className) {
  const openTag = new RegExp(`<([a-z][\\w:-]*)\\b(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${className}\\b)[^>]*>`, 'i').exec(html);
  if (!openTag) return '';
  const tagName = openTag[1].toLowerCase();
  let depth = 1;
  const tags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tags.lastIndex = openTag.index + openTag[0].length;
  let match;
  while ((match = tags.exec(html))) {
    if (/^<\//.test(match[0])) depth--;
    else if (!/\/>$/.test(match[0])) depth++;
    if (depth === 0) return html.slice(openTag.index, tags.lastIndex);
  }
  return '';
}

function sanitizeArticle(html) {
  let cleaned = String(html).replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<(script|style|svg|iframe|object|form|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  cleaned = cleaned.replace(/<(script|style|svg|iframe|object|form|noscript|template)\b[^>]*\/?\s*>/gi, ' ');
  cleaned = cleaned.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_whole, attrs, inner) => {
    const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || '';
    try {
      const url = new URL(href, 'https://www.freejobalert.com');
      if (['http:', 'https:'].includes(url.protocol) && !/(^|\.)freejobalert\.com$/i.test(url.hostname)) return `<a href="${url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${inner}</a>`;
    } catch { /* omit unsafe links while keeping their text */ }
    return inner;
  });
  return cleaned.replace(/<\/?([a-z][\w:-]*)\b([^>]*)>/gi, (tag, rawName, attrs) => {
    const name = rawName.toLowerCase();
    if (!allowedTags.has(name)) return '';
    if (/^<\//.test(tag)) return `</${name}>`;
    if (name === 'a') {
      const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] || '';
      try {
        const url = new URL(href);
        if (['http:', 'https:'].includes(url.protocol) && !/(^|\.)freejobalert\.com$/i.test(url.hostname)) return `<a href="${url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">`;
      } catch { /* strip malformed links */ }
      return '';
    }
    if (name === 'th' || name === 'td') {
      const colspan = /\bcolspan\s*=\s*["']?(\d+)/i.exec(attrs)?.[1];
      const rowspan = /\browspan\s*=\s*["']?(\d+)/i.exec(attrs)?.[1];
      return `<${name}${colspan ? ` colspan="${Math.min(Number(colspan), 20)}"` : ''}${rowspan ? ` rowspan="${Math.min(Number(rowspan), 50)}"` : ''}>`;
    }
    return `<${name}>`;
  });
}
async function fetchDetail(job) {
  const cachedDetail = detailCache.get(job.id);
  if (cachedDetail && Date.now() - cachedDetail.at < DETAIL_CACHE_MS) return cachedDetail.detail;
  const url = new URL(job.sourceUrl);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'www.freejobalert.com' || !url.pathname.startsWith('/articles/')) throw new Error('This listing has no supported article page.');
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'PVGJ-Educational-Institutions/1.0 (job details reader)', Accept: 'text/html' } });
  if (!response.ok) throw new Error(`Job details returned HTTP ${response.status}.`);
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error('The job detail page is larger than expected.');
  const article = extractClassBlock(html, 'entry-content') || extractClassBlock(html, 'article-content') || extractClassBlock(html, 'post-content') || '';
  if (!article) throw new Error('Could not find the job details on the publisher page.');
  const contentHtml = sanitizeArticle(article);
  const detail = { contentHtml, updatedAt: new Date().toISOString(), title: job.title };
  detailCache.set(job.id, { at: Date.now(), detail });
  if (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value);
  return detail;
}

router.get('/:id', async (req, res) => {
  const job = cached.jobs.find((item) => item.id === req.params.id);
  if (!job) return res.status(404).json({ message: 'This job alert is no longer in the current feed. Refresh the list and try again.' });
  try {
    const detail = await fetchDetail(job);
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ job: { id: job.id, title: job.title, category: job.category, publishedAt: job.publishedAt }, ...detail });
  } catch (error) { return res.status(502).json({ message: error.message || 'Unable to load the full job details.' }); }
});

router.get('/', async (req, res) => {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  if (!forceRefresh && cached.jobs.length && Date.now() - cached.at < CACHE_MS) return res.json({ jobs: cached.jobs, fetchedAt: new Date(cached.at).toISOString(), cached: true, errors: cached.errors });
  const results = await Promise.all(FEEDS.map(async (feed) => {
    try {
      const response = await fetch(feed.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'PVGJ-Educational-Institutions/1.0 (RSS reader)' } });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
      const parsed = await parser.parseString(await response.text());
      return { jobs: (parsed.items || []).map((item) => normalize(item, feed.name)), error: null };
    } catch (error) { return { jobs: [], error: `${feed.name}: ${error.message}` }; }
  }));
  const jobs = results.flatMap((result) => result.jobs).filter((job) => job.title && job.sourceUrl).sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  const errors = results.map((result) => result.error).filter(Boolean);
  if (jobs.length) cached = { at: Date.now(), jobs, errors };
  if (!jobs.length && cached.jobs.length) return res.json({ jobs: cached.jobs, fetchedAt: new Date(cached.at).toISOString(), cached: true, stale: true, errors });
  if (!jobs.length) return res.status(502).json({ message: 'Could not retrieve the job-alert RSS feed right now.', errors, jobs: [] });
  res.set('Cache-Control', 'no-store');
  return res.json({ jobs, fetchedAt: new Date(cached.at).toISOString(), cached: false, errors });
});

export default router;


