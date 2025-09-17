import path from 'path';
import fs from 'fs/promises';

import { Readable } from 'stream';

import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { getMemoryTemplateById, getMemoryTemplateBySlug } from './templateMemory';


const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

export interface TemplateExportResult {
  stream: Readable;
  filename: string;
  size: number;
}

export async function exportTemplateArchive(identifier: string): Promise<TemplateExportResult> {
  let template: any = null;
  try {
    template = await prisma.template.findFirst({
      where: { OR: [{ slug: identifier }, { id: identifier }] },
    });
  } catch { /* ignore */ }
  if (!template) {
    // fallback: memory by id, then by slug
    template = getMemoryTemplateById(identifier) || getMemoryTemplateBySlug(identifier);
  }
  if (!template) {
    const err: any = new Error(`Template not found: ${identifier}`);
    err.status = 404;
    throw err;
  }

  const zip = new AdmZip();


  const meta = {
    slug: template.slug,
    version: template.version,
    type: template.type,
    engine: template.engine,
    tags: template.tags || [],
  };
  zip.addFile('meta.json', Buffer.from(JSON.stringify(meta, null, 2), 'utf8'));

  const previewHtml = template.previewHtml || template.code;
  zip.addFile('index.html', Buffer.from(previewHtml, 'utf8'));

  const engine = (template.engine || '').toLowerCase();
  const sourceExt = engine === 'hbs' ? 'hbs' : 'html';
  zip.addFile(`source.${sourceExt}`, Buffer.from(template.code, 'utf8'));

  if (template.schemaJson) {
    zip.addFile('schema.json', Buffer.from(JSON.stringify(template.schemaJson, null, 2), 'utf8'));
  }

  const assetRelatives = collectAssetRelatives(previewHtml);
  for (const relPath of assetRelatives) {
    const filePath = resolveUploadsPath(relPath);
    if (!filePath) continue;
    try {
      const content = await fs.readFile(filePath);
      const zipPath = path.posix.join('assets', relPath.replace(/\\/g, '/'));
      zip.addFile(zipPath, content);
    } catch (err) {
      logger.warn('asset missing for template export', { asset: relPath, error: (err as Error)?.message });

    }
  }

  const buffer = zip.toBuffer();

  const stream = Readable.from(buffer);

  logger.info('template export bundle generated', {
    template: template.slug,
    assets: assetRelatives.length,
    size: buffer.length,
  });

  return {
    stream,
    filename: `${template.slug || template.id}.zip`,
    size: buffer.length,
  };
}

function collectAssetRelatives(html: string): string[] {
  const assets = new Set<string>();
  if (!html) return Array.from(assets);

  try {
    const $ = cheerio.load(html);
    const selectors: Array<{ selector: string; attr: string; type?: 'srcset' }> = [
      { selector: 'link[rel="stylesheet"][href]', attr: 'href' },
      { selector: 'script[src]', attr: 'src' },
      { selector: 'img[src]', attr: 'src' },
      { selector: 'img[srcset]', attr: 'srcset', type: 'srcset' },
      { selector: 'source[src]', attr: 'src' },
      { selector: 'source[srcset]', attr: 'srcset', type: 'srcset' },
      { selector: 'video[src]', attr: 'src' },
      { selector: 'audio[src]', attr: 'src' },
    ];

    const pushValue = (value: string | undefined) => {
      if (!value) return;
      const normalized = normalizeUploadPath(value);
      if (normalized) assets.add(normalized);
    };

    for (const item of selectors) {
      $(item.selector).each((_, el) => {
        const value = $(el).attr(item.attr);
        if (!value) return;
        if (item.type === 'srcset') {
          value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .forEach((part) => {
              const [url] = part.split(/\s+/, 2);
              pushValue(url);
            });
        } else {
          pushValue(value);
        }
      });
    }
  } catch {
    return Array.from(assets);
  }

  return Array.from(assets);
}

function normalizeUploadPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryIndex = trimmed.search(/[?#]/);
  const pathPart = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
  if (!pathPart.startsWith('/uploads/')) return null;
  const relative = pathPart.replace(/^\/uploads\//, '');
  const normalized = path.posix.normalize(relative);
  if (!normalized || normalized.startsWith('..')) return null;
  return normalized.replace(/^\/+/g, '');
}

function resolveUploadsPath(relative: string): string | null {
  try {
    const sanitized = path.normalize(relative).replace(/^(\.\.(?:\\|\/|$))+/, '');
    const uploadsRoot = path.resolve(UPLOADS_ROOT);
    const target = path.resolve(uploadsRoot, sanitized);
    if (!target.startsWith(uploadsRoot)) return null;
    return target;
  } catch {
    return null;
  }

}
