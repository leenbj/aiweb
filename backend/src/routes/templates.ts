import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { importZipToTemplates } from '../services/importer/zipImporter';
import { prisma } from '../database';
import { renderTemplate, composePage } from '../services/templateRenderer';
import { searchTemplates } from '../services/templateIndex';
import { getMemoryTemplateBySlug } from '../services/templateMemory';
import { exportTemplateAsZip } from '../services/templateExporter';
import { createTemplateVersion, rollbackTemplateVersion } from '../services/templateVersioning';

const router = express.Router();

function getRequestId(req: express.Request) {
  const header = req.headers['x-request-id'];
  if (Array.isArray(header)) return header[0];
  return (req as any).requestId || (req as any).id || (typeof header === 'string' ? header : undefined);
}

// Multer for ZIP upload (in-memory or temp disk). Here we use memory to keep stub simple.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// POST /api/templates/import-zip
router.post('/import-zip', upload.single('file'), async (req, res) => {
  const requestId = getRequestId(req);
  try {
    if (!req.file) {
      res.status(400);
      return res.json({ success: false, error: 'ZIP file is required' });
    }
    const userId = (req as any).user?.id || 'u_demo';
    const result = await importZipToTemplates(req.file.buffer, userId, { requestId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('import-zip error', { requestId, error: err?.message });
    const status = err?.status || 500;
    res.status(status).json({ success: false, error: err?.message || 'Server error' });
  }
});

// GET /api/templates/search
router.get('/search', async (req, res) => {
  const requestId = getRequestId(req);
  try {
    const { query, type, engine } = req.query as any;
    const tags = (req.query.tags as any) ? ([] as string[]).concat(req.query.tags as any) : undefined;
    const r = await searchTemplates({ query, type, engine, tags, limit: Number(req.query.limit)||20, offset: Number(req.query.offset)||0 });
    return res.json(r);
  } catch (err: any) {
    logger.error('templates search error', { requestId, error: err?.message });
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

router.get('/:id/export', async (req, res) => {
  const requestId = getRequestId(req);
  const templateId = req.params.id;
  try {
    const { buffer, filename } = await exportTemplateAsZip(templateId, { requestId });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Export failed';
    if (status === 404) {
      logger.warn('template export not found', { requestId, templateId, error: message });
    } else {
      logger.error('template export error', { requestId, templateId, error: message });
    }
    if (!res.headersSent) {
      res.status(status).json({ success: false, error: message });
    }
  }
});

router.post('/:id/versions', async (req, res) => {
  const requestId = getRequestId(req);
  const templateId = req.params.id;
  const { version } = req.body || {};
  if (!version) return res.status(400).json({ success: false, error: 'version is required' });
  try {
    const result = await createTemplateVersion(templateId, version, { requestId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Failed to create version';
    if (status === 409) {
      logger.warn('template version conflict', { requestId, templateId, version, error: message });
    } else {
      logger.error('template version error', { requestId, templateId, version, error: message });
    }
    res.status(status).json({ success: false, error: message });
  }
});

router.post('/:id/rollback', async (req, res) => {
  const requestId = getRequestId(req);
  const templateId = req.params.id;
  const { version } = req.body || {};
  if (!version) return res.status(400).json({ success: false, error: 'version is required' });
  try {
    const result = await rollbackTemplateVersion(templateId, version, { requestId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Failed to rollback version';
    if (status === 404) {
      logger.warn('template rollback missing', { requestId, templateId, version, error: message });
    } else {
      logger.error('template rollback error', { requestId, templateId, version, error: message });
    }
    res.status(status).json({ success: false, error: message });
  }
});

// GET /api/templates/:slug
router.get('/:slug', async (req, res) => {
  const requestId = getRequestId(req);
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
    logger.error('template get error', { requestId, error: err?.message });
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

// POST /api/templates/render
router.post('/render', async (req, res) => {
  const requestId = getRequestId(req);
  try {
    const { slug, data, theme, engine } = req.body || {};
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required' });
    const result = await renderTemplate({ slug, data, theme, engine }, { requestId });
    res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || 'Server error');
    const code = /Schema validation failed/i.test(msg) ? 422 : err?.status || 500;
    if (code === 422) {
      logger.warn('template render validation', { requestId, error: msg });
    } else {
      logger.error('template render error', { requestId, error: msg });
    }
    res.status(code).json({ success: false, error: msg });
  }
});

// POST /api/templates/compose
router.post('/compose', async (req, res) => {
  const requestId = getRequestId(req);
  try {
    const body = req.body || {};
    const result = await composePage(body, { requestId });
    res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || 'Server error');
    const code = /Schema validation failed/i.test(msg) ? 422 : err?.status || 500;
    if (code === 422) {
      logger.warn('template compose validation', { requestId, error: msg });
    } else {
      logger.error('template compose error', { requestId, error: msg });
    }
    res.status(code).json({ success: false, error: msg });
  }
});

export default router;
