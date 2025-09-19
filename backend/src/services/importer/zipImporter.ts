import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

import { extractThemeTokens } from './themeExtractor';
import { addMemoryTemplate, getMemoryTemplateBySlug } from '../templateMemory';
import { prisma } from '../../database';
import { logger } from '../../utils/logger';
import { validateTemplateZip, TemplateZipValidationError } from '../../utils/templates/zipSchemaValidator';
import { emitTemplateImported, emitTemplateImportFailed } from '../../events/templateEvents';

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

const ALLOWED_EXTS = new Set<string>([
  '.html', '.htm', '.css', '.js', '.json', '.txt',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.webm', '.ogg', '.wav', '.avif',
]);

const HTML_EXTS = new Set<string>(['.html', '.htm']);

const COMPONENT_CANDIDATES: Array<{ selector: string; slug: string }> = [
  { selector: 'header:first', slug: 'header' },
  { selector: 'footer:first', slug: 'footer' },
  { selector: 'section.hero:first', slug: 'hero-section' },
  { selector: '.hero:first', slug: 'hero' },
  { selector: '.features:first', slug: 'features' },
  { selector: '.pricing:first', slug: 'pricing' },
];

export interface ImportResult {
  importId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
}

export async function importZipToTemplates(zipBuffer: Buffer, userId: string, opts: { requestId?: string } = {}): Promise<ImportResult> {
  const importId = `imp_${uuidv4().slice(0, 8)}`;
  const baseDir = path.resolve(UPLOADS_ROOT, `u_${userId}`, importId);
  await fs.mkdir(baseDir, { recursive: true });
  const startedAt = Date.now();
  const logMeta = { importId, userId, requestId: opts.requestId };

  const assetsBase = `/uploads/u_${userId}/${importId}/`;

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    logger.info('zipImporter.start', { ...logMeta, entries: entries.length });

    try {
      validateTemplateZip(entries);
    } catch (err) {
      if (err instanceof TemplateZipValidationError) {
        logger.warn('zipImporter.validationFailed', { ...logMeta, errors: err.details });
      }
      throw err;
    }

    const pages: string[] = [];
    const componentSet = new Set<string>();
    const takenSlugs = new Set<string>();
    let cssBundle = '';

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let rel: string;
      try {
        rel = ensureRelative(entry.entryName);
      } catch {
        logger.warn('zipImporter.skipped.invalidPath', { ...logMeta, entry: entry.entryName });
        continue;
      }
      if (rel.startsWith('__MACOSX/')) continue;
      if (!isAllowed(rel)) continue;

      const ext = path.extname(rel).toLowerCase();
      const content = entry.getData();

      if (HTML_EXTS.has(ext)) {
        const html = content.toString('utf8');
        const $ = cheerio.load(html, { decodeEntities: false } as any);
        const title = $('title').first().text().trim();
        const baseName = path.basename(rel, ext);
        const pageName = title || baseName;
        const baseSlug = toSlug(pageName) || toSlug(baseName) || `page-${pages.length + 1}`;
        const pageSlug = await ensureUniqueSlug(baseSlug, takenSlugs);

        const previewHtml = rewriteAssets(html, assetsBase, rel);

        const compSlugs = await processComponentCandidates($, { pageSlug, assetsBase, takenSlugs, relPath: rel });
        compSlugs.forEach((s) => componentSet.add(s));

        const pageRecord: any = {
          type: 'page',
          name: pageName || pageSlug,
          slug: pageSlug,
          engine: 'plain',
          description: `Imported from ZIP: ${rel}`,
          code: html,
          tags: [] as string[],
          previewHtml,
        };
        try { await prisma.template.create({ data: pageRecord }); }
        catch (err) { addMemoryTemplate(pageRecord); logger.warn('zipImporter.page.storedInMemory', { ...logMeta, slug: pageSlug, error: (err as Error)?.message }); }

        pages.push(pageSlug);
      } else {
        const outPath = safeJoinUploads(baseDir, rel);
        try {
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, content);
        } catch (err) {
          logger.warn('zipImporter.asset.persistFailed', { ...logMeta, entry: rel, error: (err as Error)?.message });
        }
        if (ext === '.css') {
          try { cssBundle += content.toString('utf8') + '\n'; } catch {}
        }
      }
    }

    let themeSlug: string | undefined;
    try {
      const { tokens, css } = extractThemeTokens(cssBundle);
      if (tokens && Object.keys(tokens).length) {
        themeSlug = `theme-${importId}`;
        const themeRecord: any = {
          type: 'theme', name: 'Default Theme', slug: themeSlug, engine: 'plain',
          description: `Extracted tokens from ZIP ${importId}`,
          code: css || '', tokensJson: tokens, tags: ['theme'] as string[],
        };
        try { await prisma.template.create({ data: themeRecord }); }
        catch (err) { addMemoryTemplate(themeRecord); logger.warn('zipImporter.theme.storedInMemory', { ...logMeta, slug: themeSlug, error: (err as Error)?.message }); }
      }
    } catch (err) {
      logger.warn('zipImporter.theme.extractFailed', { ...logMeta, error: (err as Error)?.message });
    }

    const components = Array.from(componentSet);
    const durationMs = Date.now() - startedAt;
    logger.info('zipImporter.completed', { ...logMeta, pages: pages.length, components: components.length, durationMs });

    emitTemplateImported({
      importId,
      userId,
      pages,
      components,
      theme: themeSlug,
      assetsBase,
      durationMs,
      requestId: opts.requestId,
    });

    return { importId, pages, components, theme: themeSlug || 'default', assetsBase };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    emitTemplateImportFailed({
      importId,
      userId,
      durationMs,
      error,
      details: (error as any)?.details,
      requestId: opts.requestId,
    });
    throw error;
  }
}

function isAllowed(relPath: string) {
  const ext = path.extname(relPath).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

function ensureRelative(entryName: string) {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/g, '');
  const safe = path.posix.normalize(normalized);
  if (!safe || safe === '.' || safe.startsWith('..') || safe.includes('/../')) {
    throw new Error(`Invalid entry path: ${entryName}`);
  }
  return safe;
}

function safeJoinUploads(baseDir: string, relPath: string) {
  const relative = ensureRelative(relPath);
  const target = path.resolve(baseDir, relative);
  const base = path.resolve(baseDir) + path.sep;
  if (!target.startsWith(base)) throw new Error(`Unsafe path detected: ${relPath}`);
  return target;
}

async function processComponentCandidates(
  $: CheerioAPI,
  options: { pageSlug: string; assetsBase: string; takenSlugs: Set<string>; relPath: string },
) {
  const slugs: string[] = [];
  for (const candidate of COMPONENT_CANDIDATES) {
    const el = $(candidate.selector).first();
    if (!el || el.length === 0) continue;
    const fragmentHtml = el.html() || '';
    if (!fragmentHtml.trim()) continue;

    const base = toSlug(`${options.pageSlug}-${candidate.slug}`) || candidate.slug || 'component';
    const slug = await ensureUniqueSlug(base, options.takenSlugs);
    const name = toTitleCase(slug);
    const preview = rewriteAssets(fragmentHtml, options.assetsBase, options.relPath);

    const componentRecord: any = {
      type: 'component', name, slug, engine: 'hbs',
      description: `Imported component from ${options.relPath} (${candidate.selector})`,
      code: fragmentHtml, schemaJson: undefined, tags: [candidate.slug], previewHtml: preview,
    };
    try { await prisma.template.create({ data: componentRecord }); }
    catch (err) { addMemoryTemplate(componentRecord); logger.warn('zipImporter.component.storedInMemory', { pageSlug: options.pageSlug, slug, error: (err as Error)?.message }); }

    slugs.push(slug);
  }
  return slugs;
}

function toSlug(input: string) {
  if (!input) return '';
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toTitleCase(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function rewriteAssets(html: string, assetsBase: string, htmlRelPath?: string) {
  if (!html) return html;
  const base = assetsBase.replace(/\/?$/, '/');
  const htmlDir = htmlRelPath ? path.posix.dirname(htmlRelPath).replace(/^\.$/, '') : '';
  const normalizedDir = htmlDir === '.' ? '' : htmlDir;
  try {
    const $ = cheerio.load(html, { decodeEntities: false } as any);
    const rewrite = (v: string) => {
      const trimmed = (v || '').trim();
      if (!trimmed) return v;
      if (/^(?:https?:|data:|\/\/)/i.test(trimmed)) return trimmed;
      if (/^[a-z]+:/i.test(trimmed)) return trimmed;
      if (trimmed.startsWith('#') || trimmed.startsWith('?')) return trimmed;
      if (trimmed.startsWith('/uploads/')) return trimmed;
      const stripLeadingSlash = trimmed.replace(/^\/+/g, '');
      const joined = normalizedDir
        ? path.posix.join(normalizedDir, stripLeadingSlash)
        : stripLeadingSlash;
      const normalized = path.posix.normalize(joined);
      if (!normalized || normalized.startsWith('..')) return trimmed;
      return base + normalized.replace(/^\/+/g, '');
    };
    $('link[rel="stylesheet"][href]').each((_, el) => {
      const v = $(el).attr('href'); if (v) $(el).attr('href', rewrite(v));
    });
    $('script[src]').each((_, el) => {
      const v = $(el).attr('src'); if (v) $(el).attr('src', rewrite(v));
    });
    $('img[src]').each((_, el) => {
      const v = $(el).attr('src'); if (v) $(el).attr('src', rewrite(v));
    });
    const effectiveBase = normalizedDir ? `${base}${normalizedDir.replace(/\/?$/, '/')}` : base;
    if ($('head base').length === 0) {
      if ($('head').length) $('head').prepend(`<base href="${effectiveBase}">`);
      else $('html').prepend(`<head><base href="${effectiveBase}"></head>`);
    }
    return $.html();
  } catch {
    return html;
  }
}

async function ensureUniqueSlug(base: string, taken: Set<string>) {
  let i = 0;
  while (true) {
    const slug = i === 0 ? base : `${base}-${i}`;
    if (!taken.has(slug) && !(await slugExists(slug))) {
      taken.add(slug);
      return slug;
    }
    i++;
  }
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
