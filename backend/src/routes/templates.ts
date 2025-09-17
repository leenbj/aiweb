import express from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { importZipToTemplates } from '../services/importer/zipImporter';
import { prisma } from '../database';
import { renderTemplate, composePage } from '../services/templateRenderer';
import { searchTemplates } from '../services/templateIndex';
import { getMemoryTemplateBySlug } from '../services/templateMemory';

import { exportTemplateArchive } from '../services/templateExporter';
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

  const startedAt = Date.now();

  try {
    if (!req.file) {
      res.status(400);
      return res.json({ success: false, error: 'ZIP file is required' });
    }
    const userId = (req as any).user?.id || 'u_demo';
    const requestId = getRequestId(req);

    const result = await importZipToTemplates(req.file.buffer, userId, { requestId });
    logger.info('templates import success', {
      importId: result.importId,
      pages: result.pages.length,
      components: result.components.length,
      durationMs: Date.now() - startedAt,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('import-zip error', {
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    res.status(500).json({ success: false, error: err?.message || 'Server error' });

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

  const startedAt = Date.now();
  const { id } = req.params;
  try {
    const { stream, filename, size } = await exportTemplateArchive(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (size) res.setHeader('Content-Length', String(size));

    stream.on('error', (err) => {
      logger.error('template export stream error', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Export stream error' });
      } else {
        res.end();
      }
    });

    stream.on('end', () => {
      logger.info('template export completed', {
        templateId: id,
        durationMs: Date.now() - startedAt,
        size,
      });
    });

    stream.pipe(res);
  } catch (err: any) {
    const status = err?.status || err?.statusCode || (String(err?.message || '').includes('not found') ? 404 : 500);
    logger.error('template export error', err);
    if (!res.headersSent) {
      res.status(status).json({ success: false, error: err?.message || 'Export failed' });
    }

  }
});

// POST /api/templates/:id/versions  { version: "1.2.0" }
router.post('/:id/versions', async (req, res) => {
  const startedAt = Date.now();
  const { id } = req.params;
  const { version } = req.body || {};
  if (!version || typeof version !== 'string') {
    return res.status(400).json({ success: false, error: 'version is required and must be string' });
  }
  try {
    const r = await createTemplateVersion(id, version, { requestId: getRequestId(req) });
    res.json({ success: true, data: r });
  } catch (err: any) {
    const status = err?.status || err?.statusCode || (String(err?.message || '').includes('exists') ? 409 : 500);
    logger.error('template version create error', { id, version, durationMs: Date.now() - startedAt, error: err?.message });
    res.status(status).json({ success: false, error: err?.message || 'Version create failed' });
  }
});

// POST /api/templates/:id/rollback  { version: "1.1.0" }
router.post('/:id/rollback', async (req, res) => {
  const startedAt = Date.now();
  const { id } = req.params;
  const { version } = req.body || {};
  if (!version || typeof version !== 'string') {
    return res.status(400).json({ success: false, error: 'version is required and must be string' });
  }
  try {
    const r = await rollbackTemplateVersion(id, version, { requestId: getRequestId(req) });
    res.json({ success: true, data: r });
  } catch (err: any) {
    const status = err?.status || err?.statusCode || (String(err?.message || '').includes('not found') ? 404 : 500);
    logger.error('template version rollback error', { id, version, durationMs: Date.now() - startedAt, error: err?.message });
    res.status(status).json({ success: false, error: err?.message || 'Rollback failed' });
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
