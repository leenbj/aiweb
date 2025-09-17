import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

import type { CheerioAPI } from 'cheerio';

import Handlebars from 'handlebars';
import { parametrizeComponentHtml } from './hbsParametrize';
import { extractThemeTokens } from './themeExtractor';
import { addMemoryTemplate } from '../templateMemory';
import { ensureRelative } from '../../utils/file';


const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';


const ALLOWED_EXTS = new Set<string>([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.json',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.mp3',
  '.mp4',
  '.webm',
  '.ogg',
  '.wav',
  '.avif',
]);

const HTML_EXTS = new Set<string>(['.html', '.htm']);

const COMPONENT_CANDIDATES: Array<{ selector: string; slug: string }> = [
  { selector: 'header:first', slug: 'header' },
  { selector: 'footer:first', slug: 'footer' },
  { selector: 'section.hero:first', slug: 'hero-section' },
  { selector: '.hero:first', slug: 'hero' },
  { selector: '.pricing:first', slug: 'pricing' },
  { selector: 'section.pricing:first', slug: 'pricing-section' },
  { selector: '[class*=pricing]:first', slug: 'pricing-block' },
  { selector: '.features:first', slug: 'features' },
  { selector: '[class*=feature]:first', slug: 'feature-block' },
  { selector: '.team:first', slug: 'team' },
  { selector: '[class*=team]:first', slug: 'team-block' },
  { selector: '.service:first', slug: 'service' },
  { selector: '[class*=service]:first', slug: 'service-block' },
];


export interface ImportResult {
  importId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
}


export async function importZipToTemplates(zipBuffer: Buffer, userId: string): Promise<ImportResult> {
  const importId = `imp_${uuidv4().slice(0, 8)}`;

  const baseDir = path.resolve(UPLOADS_ROOT, `u_${userId}`, importId);
  await fs.mkdir(baseDir, { recursive: true });

  const requestId = opts?.requestId;
  const logMeta = { importId, userId, requestId };
  const startedAt = Date.now();

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  logger.info('zipImporter.start', { ...logMeta, entries: entries.length });

  const pages: string[] = [];

  const componentSet = new Set<string>();

  let cssBundle = '';
  const takenSlugs = new Set<string>();
  const assetsBase = `/uploads/u_${userId}/${importId}/`;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let relativePath: string;
    try {
      relativePath = ensureRelative(entry.entryName);
    } catch {
      logger.warn('zipImporter skipped entry due to invalid path', { entry: entry.entryName });
      continue;
    }

    if (relativePath.startsWith('__MACOSX/')) continue;

    if (!isAllowed(relativePath)) {
      logger.warn('zipImporter skipped file with disallowed extension', { entry: relativePath });
      continue;
    }

    const ext = path.extname(relativePath).toLowerCase();
    const content = entry.getData();


    if (HTML_EXTS.has(ext)) {
      const html = content.toString('utf8');
      const $ = cheerio.load(html, { decodeEntities: false } as any);
      const title = $('title').first().text().trim();
      const baseName = path.basename(relativePath, ext);
      const pageName = title || baseName;
      const pageSlugBase = toSlug(pageName) || toSlug(baseName) || `page-${pages.length + 1}`;
      const pageSlug = await ensureUniqueSlug(pageSlugBase, takenSlugs);

      const previewHtml = rewriteAssets(html, assetsBase);

      const componentSlugs = await processComponentCandidates($, {
        pageSlug,
        assetsBase,
        takenSlugs,
        relPath: relativePath,
      });
      componentSlugs.forEach((slug) => componentSet.add(slug));

      const pageRecord: any = {
        type: 'page',
        name: pageName || pageSlug,
        slug: pageSlug,
        engine: 'plain',
        description: `Imported from ZIP: ${relativePath}`,
        code: html,
        tags: [] as string[],
        previewHtml,
      };

      try {
        await prisma.template.create({ data: pageRecord });
      } catch (err) {
        addMemoryTemplate(pageRecord);
        logger.warn('stored page template in memory', { slug: pageSlug, error: (err as Error)?.message });
      }

      pages.push(pageSlug);
    } else {
      const outPath = safeJoinUploads(baseDir, relativePath);
      try {
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, content);
      } catch (err) {
        logger.error('failed to persist imported asset', { entry: relativePath, error: (err as Error)?.message });
      }

      if (ext === '.css') {
        try {
          cssBundle += content.toString('utf8') + '\n';
        } catch (err) {
          logger.warn('failed to read css for theme extraction', { entry: relativePath, error: (err as Error)?.message });
        }

      }

      pages.push(slug);
      continue;
    }

  } catch (err) {
    logger.error('zipImporter.failed', { ...logMeta, error: (err as any)?.message });
    throw err;
  }


  let themeSlug: string | undefined;

  try {
    const { tokens, css } = extractThemeTokens(cssBundle);
    if (tokens && Object.keys(tokens).length) {
      themeSlug = `theme-${importId}`;
      const themeRecord: any = {
        type: 'theme',
        name: 'Default Theme',
        slug: themeSlug,
        engine: 'plain',
        description: `Extracted tokens from ZIP ${importId}`,
        code: css || '',
        tokensJson: tokens,
        tags: ['theme'] as string[],
      };

      try {
        await prisma.template.create({ data: themeRecord });
      } catch (err) {
        addMemoryTemplate(themeRecord);
        logger.warn('stored theme template in memory', { slug: themeSlug, error: (err as Error)?.message });
      }
    }
  } catch (err) {

    logger.warn('theme token extraction failed', { importId, error: (err as Error)?.message });
  }

  const componentList = Array.from(componentSet);
  logger.info('zip import completed', {
    importId,
    pages: pages.length,
    components: componentList.length,
  });


  return {
    importId,
    pages,

    components: componentList,
    theme: themeSlug || 'default',

    assetsBase,
  };
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
  if (!target.startsWith(baseDir)) {
    throw new Error(`Unsafe path detected: ${relPath}`);
  }
  return target;
}

async function processComponentCandidates(
  $: CheerioAPI,
  options: { pageSlug: string; assetsBase: string; takenSlugs: Set<string>; relPath: string },
) {
  const slugs: string[] = [];
  const seen = new Set<any>();

  for (const candidate of COMPONENT_CANDIDATES) {
    const el = $(candidate.selector).first();
    if (!el || el.length === 0) continue;
    const node = el.get(0);
    if (!node || seen.has(node)) continue;
    seen.add(node);

    const fragmentHtml = $.html(el) || '';
    if (!fragmentHtml.trim()) continue;

    let code = fragmentHtml;
    let schemaJson: any | undefined;
    try {
      const result = parametrizeComponentHtml(fragmentHtml);
      code = result.code || fragmentHtml;
      schemaJson = result.schemaJson;
    } catch (err) {
      logger.warn('component parametrization failed', { selector: candidate.selector, error: (err as Error)?.message });
    }

    const sample = buildSampleData(schemaJson);
    let preview = tryCompile(code, sample);
    preview = rewriteAssets(preview, options.assetsBase);

    const base = toSlug(`${options.pageSlug}-${candidate.slug}`) || candidate.slug || 'component';
    const slug = await ensureUniqueSlug(base, options.takenSlugs);
    const name = toTitleCase(slug);

    const componentRecord: any = {
      type: 'component',
      name,
      slug,
      engine: 'hbs',
      description: `Imported component from ${options.relPath} (${candidate.selector})`,
      code,
      schemaJson,
      tags: [candidate.slug],
      previewHtml: preview,
    };

    try {
      await prisma.template.create({ data: componentRecord });
    } catch (err) {
      addMemoryTemplate(componentRecord);
      logger.warn('stored component template in memory', { slug, error: (err as Error)?.message });
    }

    slugs.push(slug);
  }

  return slugs;
}

function toSlug(input: string) {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toTitleCase(slug: string) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Component';
}

async function ensureUniqueSlug(baseSlug: string, taken: Set<string>) {
  let sanitized = toSlug(baseSlug);
  if (!sanitized) sanitized = `tpl-${uuidv4().slice(0, 6)}`;

  let candidate = sanitized;
  while (taken.has(candidate) || (await slugExists(candidate))) {
    candidate = `${sanitized}-${uuidv4().slice(0, 6)}`;
  }

  taken.add(candidate);
  return candidate;
}

async function slugExists(slug: string) {
  try {
    const rec = await prisma.template.findUnique({ where: { slug } });
    return !!rec;
  } catch {
    return false;
  }
}


function buildSampleData(schema?: any) {
  const data: any = {
    title: '示例标题',
    subtitle: '示例副标题',
    cta: { text: '立即查看', href: '#' },
    image: { src: 'https://via.placeholder.com/640x360?text=Preview', alt: '示例图片' },
  };

  const props = schema && typeof schema === 'object' ? schema.properties || {} : {};
  const itemsSchema = props.items;
  if (itemsSchema && itemsSchema.type === 'array') {
    const schemaItems = itemsSchema.items || {};
    if (schemaItems.type === 'object') {
      data.items = [
        { name: '基础版', price: '¥99/月' },
        { name: '专业版', price: '¥199/月' },
        { name: '企业版', price: '¥399/月' },
      ];
    } else {
      data.items = ['特性一', '特性二', '特性三'];
    }
  } else {
    data.items = ['特性一', '特性二', '特性三'];

  }


  return data;

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

function rewriteAssets(html: string, assetsBase: string) {
  if (!html) return html;
  const base = assetsBase.replace(/\/?$/, '/');
  try {
    const $ = cheerio.load(html, { decodeEntities: false } as any);
    const rewriteSingle = (value: string) => {
      const trimmed = (value || '').trim();
      if (!trimmed) return value;
      const queryIndex = trimmed.search(/[?#]/);
      const pathPart = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
      const suffix = queryIndex === -1 ? '' : trimmed.slice(queryIndex);
      if (/^(?:https?:|data:|\/\/)/i.test(pathPart)) return trimmed;
      if (pathPart.startsWith('/uploads/')) return trimmed;
      const withoutDot = pathPart.replace(/^\.?\//, '').replace(/^\/+/g, '');
      if (!withoutDot) return trimmed;
      const normalized = path.posix.normalize(withoutDot);
      if (!normalized || normalized.startsWith('..')) return trimmed;
      return base + normalized.replace(/^\/+/g, '') + suffix;
    };

    const rewriteSrcset = (value: string) => {
      return value
        .split(',')
        .map((part) => {
          const trimmed = part.trim();
          if (!trimmed) return trimmed;
          const [url, descriptor] = trimmed.split(/\s+/, 2);
          const rewritten = rewriteSingle(url);
          return descriptor ? `${rewritten} ${descriptor}` : rewritten;
        })
        .join(', ');
    };

    const targets: Array<{ selector: string; attr: string; type?: 'srcset' }> = [
      { selector: 'link[rel="stylesheet"][href]', attr: 'href' },
      { selector: 'script[src]', attr: 'src' },
      { selector: 'img[src]', attr: 'src' },
      { selector: 'img[srcset]', attr: 'srcset', type: 'srcset' },
    ];

    for (const t of targets) {
      $(t.selector).each((_, el) => {
        const $el = $(el);
        const value = $el.attr(t.attr);
        if (!value) return;
        const rewritten = t.type === 'srcset' ? rewriteSrcset(value) : rewriteSingle(value);
        $el.attr(t.attr, rewritten);
      });

    }

    if ($('head base').length === 0) {
      if ($('head').length) {
        $('head').prepend(`<base href="${base}">`);
      } else {
        $('html').prepend(`<head><base href="${base}"></head>`);
      }
    }

    return $.html();
  } catch {
    return html;

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

