import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { importZipToTemplates } from '../services/importer/zipImporter';
import { prisma } from '../database';
import { renderTemplate, composePage } from '../services/templateRenderer';
import { searchTemplates } from '../services/templateIndex';
import { getMemoryTemplateBySlug } from '../services/templateMemory';

const router = express.Router();

// Multer for ZIP upload (in-memory or temp disk). Here we use memory to keep stub simple.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/templates/import-zip
router.post('/import-zip', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400);
      return res.json({ success: false, error: 'ZIP file is required' });
    }
    const userId = (req as any).user?.id || 'u_demo';
    const result = await importZipToTemplates(req.file.buffer, userId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('import-zip error', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// GET /api/templates/search
router.get('/search', async (req, res) => {
  try {
    const { query, type, engine } = req.query as any;
    const tags = (req.query.tags as any) ? ([] as string[]).concat(req.query.tags as any) : undefined;
    const r = await searchTemplates({ query, type, engine, tags, limit: Number(req.query.limit)||20, offset: Number(req.query.offset)||0 });
    return res.json(r);
  } catch (err: any) {
    logger.error('templates search error', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// GET /api/templates/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    try {
      const tpl = await prisma.template.findUnique({ where: { slug } });
      if (!tpl) return res.status(404).json({ success: false, error: `Template not found: ${slug}` });
      return res.json(tpl);
    } catch {
      const mem = getMemoryTemplateBySlug(slug);
      if (mem) return res.json(mem);
      return res.status(404).json({ success: false, error: `Template not found: ${slug}` });
    }
  } catch (err: any) {
    logger.error('template get error', err);
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// POST /api/templates/render
router.post('/render', async (req, res) => {
  try {
    const { slug, data, theme, engine } = req.body || {};
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required' });
    const result = await renderTemplate({ slug, data, theme, engine });
    res.json(result);
  } catch (err: any) {
    logger.error('template render error', err);
    const msg = String(err?.message || 'Server error');
    const code = /Schema validation failed/i.test(msg) ? 422 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// POST /api/templates/compose
router.post('/compose', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await composePage(body);
    res.json(result);
  } catch (err: any) {
    logger.error('template compose error', err);
    const msg = String(err?.message || 'Server error');
    const code = /Schema validation failed/i.test(msg) ? 422 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

export default router;
