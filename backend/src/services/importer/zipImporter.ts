import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

import { prisma } from '../../database';
import { logger } from '../../utils/logger';
import { addMemoryTemplate, getMemoryTemplateBySlug } from '../templateMemory';

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

const ALLOWED_EXTS = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.jpg',
  '.jpeg',
  '.png',
  '.svg',
  '.gif',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
]);

const HTML_EXTS = new Set(['.html', '.htm']);

export interface ImportResult {
  importId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
}

export async function importZipToTemplates(zipBuffer: Buffer, userId: string): Promise<ImportResult> {
  const importId = `imp_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
  const baseDir = path.resolve(UPLOADS_ROOT, `u_${userId}`, importId);
  await fs.mkdir(baseDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const pages: string[] = [];
  const components: string[] = [];
  const seenSlugs = new Set<string>();
  const skipped: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const normalized = ensureRelative(entry.entryName);
    if (!normalized) {
      skipped.push(entry.entryName);
      logger.warn('zipImporter: skip unsafe path', { entry: entry.entryName });
      continue;
    }

    const ext = getExtension(normalized);
    if (!ALLOWED_EXTS.has(ext)) {
      skipped.push(normalized);
      logger.warn('zipImporter: skip disallowed file', { entry: normalized });
      continue;
    }

    const data = entry.getData();
    if (HTML_EXTS.has(ext)) {
      const html = data.toString('utf8');
      const title = extractTitle(html) || toDisplayName(path.basename(normalized, ext));
      const baseSlug = slugify(title || path.basename(normalized, ext));
      const slug = await ensureUniqueSlug(baseSlug || `page-${pages.length + 1}`, seenSlugs);

      const templateRecord = {
        type: 'page',
        name: title || slugToName(slug),
        slug,
        engine: 'plain',
        description: `Imported from ZIP entry ${normalized}`,
        code: html,
        tags: [] as string[],
        previewHtml: html,
      };

      try {
        await prisma.template.create({ data: templateRecord as any });
      } catch (error) {
        logger.warn('zipImporter: prisma create failed, fallback to memory template', {
          slug,
          error: error instanceof Error ? error.message : String(error),
        });
        addMemoryTemplate(templateRecord);
      }

      pages.push(slug);
      continue;
    }

    try {
      const filePath = safeJoinUploads(baseDir, normalized);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data);
    } catch (error) {
      skipped.push(normalized);
      logger.warn('zipImporter: failed to persist asset', {
        entry: normalized,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const assetsBase = `/uploads/u_${userId}/${importId}/`;
  logger.info('zipImporter: completed static import', {
    importId,
    pages: pages.length,
    skipped,
  });

  return {
    importId,
    pages,
    components,
    theme: undefined,
    assetsBase,
  };
}

function ensureRelative(entryName: string): string | null {
  if (!entryName) return null;
  const sanitized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(sanitized).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

function safeJoinUploads(baseDir: string, relativePath: string): string {
  const target = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir);
  if (target === normalizedBase) return target;
  const prefix = normalizedBase.endsWith(path.sep) ? normalizedBase : `${normalizedBase}${path.sep}`;
  if (!target.startsWith(prefix)) {
    throw new Error('Path traversal detected');
  }
  return target;
}

function getExtension(filePath: string): string {
  return path.extname(filePath || '').toLowerCase();
}

function extractTitle(html: string): string | null {
  try {
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    return title || null;
  } catch (error) {
    logger.warn('zipImporter: failed to extract title', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function ensureUniqueSlug(baseSlug: string, seen: Set<string>): Promise<string> {
  let candidate = baseSlug;
  if (!candidate) candidate = `page-${Math.random().toString(36).slice(2, 6)}`;

  while (seen.has(candidate) || (await slugExists(candidate))) {
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${baseSlug}-${suffix}`;
  }

  seen.add(candidate);
  return candidate;
}

async function slugExists(slug: string): Promise<boolean> {
  try {
    const existing = await prisma.template.findUnique({ where: { slug } });
    if (existing) return true;
  } catch (error) {
    logger.debug('zipImporter: failed to verify slug via prisma', {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return Boolean(getMemoryTemplateBySlug(slug));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toDisplayName(input: string): string {
  const cleaned = input.replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return input;
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function slugToName(slug: string): string {
  return toDisplayName(slug);
}

