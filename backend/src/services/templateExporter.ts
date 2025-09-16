import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { ensureRelative } from '../utils/file';

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

export async function exportTemplateAsZip(identifier: string, opts?: { requestId?: string }) {
  const { requestId } = opts || {};
  const startedAt = Date.now();
  const logMeta = { identifier, requestId };
  logger.info('template.export.start', logMeta);

  const tpl = await prisma.template.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
  });
  if (!tpl) {
    const err = new Error(`Template not found: ${identifier}`);
    (err as any).status = 404;
    throw err;
  }

  const zip = new AdmZip();
  const engine = (tpl.engine || 'plain').toLowerCase();
  const baseName = tpl.slug || tpl.id;

  if (engine === 'hbs') {
    zip.addFile('template.hbs', Buffer.from(tpl.code || '', 'utf8'));
  } else if (engine === 'react') {
    zip.addFile('template.tsx', Buffer.from(tpl.code || '', 'utf8'));
  } else {
    zip.addFile('index.html', Buffer.from(tpl.code || '', 'utf8'));
  }

  if (tpl.previewHtml) {
    zip.addFile('preview.html', Buffer.from(String(tpl.previewHtml), 'utf8'));
  }

  const meta = {
    id: tpl.id,
    slug: tpl.slug,
    name: tpl.name,
    description: tpl.description || '',
    version: tpl.version,
    type: tpl.type,
    engine: tpl.engine,
    tags: tpl.tags || [],
    schema: tpl.schemaJson || null,
    tokens: tpl.tokensJson || null,
    exportedAt: new Date().toISOString(),
  };
  zip.addFile('meta.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf8'));

  const assetPaths = collectAssetPaths(tpl.code || '', tpl.previewHtml || '');
  const writtenAssets: string[] = [];
  for (const asset of assetPaths) {
    const normalized = asset.split('?')[0].split('#')[0];
    if (!normalized.startsWith('/uploads/')) continue;
    try {
      const rel = ensureRelative(normalized.replace(/^\/uploads\//, ''));
      const abs = path.resolve(UPLOADS_ROOT, rel);
      const data = await fs.readFile(abs);
      const entryPath = path.posix.join('assets', rel.replace(/\\/g, '/'));
      zip.addFile(entryPath, data);
      writtenAssets.push(rel);
    } catch (err: any) {
      logger.warn('template.export.assetMissing', { ...logMeta, asset, error: err?.message });
    }
  }

  const buffer = zip.toBuffer();
  const filename = `${baseName || 'template'}-${tpl.version || '1.0.0'}.zip`;
  logger.info('template.export.success', { ...logMeta, assets: writtenAssets.length, durationMs: Date.now() - startedAt });

  return { buffer, filename, assetCount: writtenAssets.length };
}

function collectAssetPaths(...sources: string[]) {
  const set = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    try {
      const $ = cheerio.load(src);
      $('[src], [href]').each((_, el) => {
        const $el = $(el);
        const val = $el.attr('src') || $el.attr('href') || '';
        if (!val) return;
        if (/^https?:/i.test(val) || /^data:/i.test(val)) return;
        set.add(val);
      });
    } catch {}
    const matches = String(src).match(/['"`]?\(?(\/uploads\/[^'"`\s)]+)/gi) || [];
    matches.forEach(m => {
      const cleaned = m.replace(/^['"`\(]/, '');
      if (cleaned.startsWith('/uploads/')) set.add(cleaned);
    });
  }
  return Array.from(set);
}
