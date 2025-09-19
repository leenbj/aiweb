import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

import * as cheerio from 'cheerio';
type LoadOptions = cheerio.LoadOptions;

import { prisma } from '../database';
import { logger } from '../utils/logger';

const UPLOADS_ROOT = path.resolve(
  process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'),
);
const WEBSITE_PREFIX = 'websites';

interface PageInput {
  slug: string;
  html: string;
}

interface PersistOptions {
  requestId?: string;
}

interface FileAsset {
  relativePath: string;
  buffer: Buffer;
  mime: string;
}

interface PersistedPage {
  slug: string;
  html: string;
  filePath: string;
  publicPath: string;
}

interface PersistedAsset {
  path: string;
  publicPath: string;
  mime: string;
  size: number;
  hash: string;
}

interface PersistResult {
  pages: PersistedPage[];
  assets: PersistedAsset[];
}

const STYLE_SELECTOR = 'style';
const STYLESHEET_SELECTOR = 'link[rel="stylesheet"]';
const SCRIPT_SELECTOR = 'script';

const INLINE_SCRIPT_TYPES = new Set(['', 'text/javascript', 'application/javascript']);

export async function persistWebsiteAssets(
  websiteId: string,
  pagesInput: PageInput[],
  options: PersistOptions = {},
): Promise<PersistResult> {
  const baseRelative = path.posix.join(WEBSITE_PREFIX, websiteId);
  const websiteRoot = path.resolve(UPLOADS_ROOT, WEBSITE_PREFIX, websiteId);

  // Clear existing directory and DB records
  await fs.rm(websiteRoot, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(websiteRoot, { recursive: true });

  await prisma.websiteAsset.deleteMany({ where: { websiteId } });

  const pages: PersistedPage[] = [];
  const assetRecords: PersistedAsset[] = [];

  const pageSlugCounter = new Map<string, number>();

  const inputPages = Array.isArray(pagesInput) && pagesInput.length > 0
    ? pagesInput
    : [{ slug: 'index', html: '' }];

  for (let index = 0; index < inputPages.length; index += 1) {
    const input = inputPages[index];
    const sanitizedSlug = makePageSlug(input.slug || `page-${index + 1}`, pageSlugCounter);
    const pageFileName = index === 0 ? 'index.html' : `${sanitizedSlug}.html`;
    const pageRelativePath = path.posix.join(baseRelative, pageFileName);
    const pageAbsolutePath = path.join(websiteRoot, pageFileName);

    const { html, assets } = await extractAssetsFromHtml({
      html: input.html || '',
      slug: sanitizedSlug,
      baseRelative,
    });

    await ensureDir(path.dirname(pageAbsolutePath));
    await fs.writeFile(pageAbsolutePath, html, 'utf8');

    const htmlBuffer = Buffer.from(html, 'utf8');
    assetRecords.push(buildAssetRecord(pageRelativePath, 'text/html', htmlBuffer));
    pages.push({
      slug: sanitizedSlug,
      html,
      filePath: pageRelativePath,
      publicPath: `/uploads/${pageRelativePath}`,
    });

    for (const asset of assets) {
      const absoluteAssetPath = path.join(UPLOADS_ROOT, asset.relativePath);
      await ensureDir(path.dirname(absoluteAssetPath));
      await fs.writeFile(absoluteAssetPath, asset.buffer);
      assetRecords.push(buildAssetRecord(asset.relativePath, asset.mime, asset.buffer));
    }
  }

  if (assetRecords.length > 0) {
    await prisma.websiteAsset.createMany({
      data: assetRecords.map((record) => ({
        websiteId,
        path: record.path,
        mime: record.mime,
        size: record.size,
        hash: record.hash,
      })),
      skipDuplicates: true,
    });
  }

  if (options.requestId) {
    logger.info('website.assets.persisted', {
      requestId: options.requestId,
      websiteId,
      pages: pages.length,
      assets: assetRecords.length,
    });
  }

  return { pages, assets: assetRecords };
}

async function extractAssetsFromHtml(context: {
  html: string;
  slug: string;
  baseRelative: string;
}): Promise<{ html: string; assets: FileAsset[] }> {
  const { html, slug, baseRelative } = context;
  const assets: FileAsset[] = [];
  const loadOptions: LoadOptions = { decodeEntities: false };
  const $ = cheerio.load(html || '', loadOptions);

  const inlineStyles: string[] = [];
  $(STYLE_SELECTOR).each((_, el) => {
    const css = $(el).html();
    if (css && css.trim().length > 0) {
      inlineStyles.push(css);
    }
    $(el).remove();
  });

  if (inlineStyles.length > 0) {
    const cssContent = inlineStyles.join('\n\n');
    const cssRelative = path.posix.join(baseRelative, 'assets', 'styles', `${slug}-inline.css`);
    assets.push({
      relativePath: cssRelative,
      buffer: Buffer.from(cssContent, 'utf8'),
      mime: 'text/css',
    });
    appendStylesheetLink($, `/uploads/${cssRelative}`);
  }

  const stylesheetElements = $(STYLESHEET_SELECTOR).toArray();
  for (const el of stylesheetElements) {
    const element = $(el);
    const href = element.attr('href');
    if (!href) continue;

    if (isRemoteUrl(href)) {
      try {
        const { buffer } = await fetchAsset(href);
        const cssRelative = path.posix.join(baseRelative, 'assets', 'styles', `${slug}-remote-${hashBuffer(buffer).slice(0, 10)}.css`);
        assets.push({
          relativePath: cssRelative,
          buffer,
          mime: 'text/css',
        });
        element.attr('href', `/uploads/${cssRelative}`);
      } catch (error) {
        logger.warn('website.assets.fetchCssFailed', {
          href,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (href.startsWith('/uploads/')) {
      // Already a local asset; leave as-is.
      continue;
    }
  }

  const inlineScripts: Record<'default' | 'module', string[]> = { default: [], module: [] };
  const scriptElements = $(SCRIPT_SELECTOR).toArray();
  for (const el of scriptElements) {
    const element = $(el);
    const src = element.attr('src');
    const typeAttr = (element.attr('type') || '').trim().toLowerCase();

    if (src) {
      if (isRemoteUrl(src)) {
        try {
          const { buffer } = await fetchAsset(src);
          const jsRelative = path.posix.join(baseRelative, 'assets', 'scripts', `${slug}-remote-${hashBuffer(buffer).slice(0, 10)}.js`);
          assets.push({
            relativePath: jsRelative,
            buffer,
            mime: 'application/javascript',
          });
          element.attr('src', `/uploads/${jsRelative}`);
        } catch (error) {
          logger.warn('website.assets.fetchJsFailed', {
            src,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      continue;
    }

    if (typeAttr && !INLINE_SCRIPT_TYPES.has(typeAttr) && typeAttr !== 'module') {
      continue; // preserve non-standard script types inline
    }

    const scriptContent = element.html();
    if (!scriptContent || scriptContent.trim().length === 0) {
      element.remove();
      continue;
    }

    const bucket = typeAttr === 'module' ? 'module' : 'default';
    inlineScripts[bucket].push(scriptContent);
    element.remove();
  }

  for (const [type, snippets] of Object.entries(inlineScripts) as Array<['default' | 'module', string[]]>) {
    if (snippets.length === 0) continue;
    const combined = snippets.join('\n;\n');
    const jsRelative = path.posix.join(baseRelative, 'assets', 'scripts', `${slug}-inline${type === 'module' ? '-module' : ''}.js`);
    assets.push({
      relativePath: jsRelative,
      buffer: Buffer.from(combined, 'utf8'),
      mime: 'application/javascript',
    });
    const scriptEl = $('<script></script>');
    if (type === 'module') scriptEl.attr('type', 'module');
    scriptEl.attr('src', `/uploads/${jsRelative}`);
    $('body').append(scriptEl);
  }

  const rawDoctype = extractDoctype(html);
  const serialized = $.html(undefined, loadOptions);
  const finalHtml = rawDoctype ? `${rawDoctype}\n${removeDoctype(serialized)}` : serialized;

  return { html: finalHtml, assets };
}

function appendStylesheetLink($: cheerio.CheerioAPI, href: string) {
  const head = $('head');
  const linkTag = `<link rel="stylesheet" href="${href}">`;
  if (head.length) {
    head.append(linkTag);
  } else {
    $.root().prepend(`<head>${linkTag}</head>`);
  }
}

async function fetchAsset(url: string): Promise<{ buffer: Buffer }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer) };
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function makePageSlug(raw: string, counter: Map<string, number>): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
  const count = counter.get(base) || 0;
  counter.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildAssetRecord(relativePath: string, mime: string, buffer: Buffer): PersistedAsset {
  const normalized = relativePath.replace(/\\/g, '/');
  return {
    path: normalized,
    publicPath: `/uploads/${normalized}`,
    mime,
    size: buffer.length,
    hash: hashBuffer(buffer),
  };
}

function extractDoctype(source: string): string | null {
  const match = source.match(/<!DOCTYPE[^>]*>/i);
  return match ? match[0] : null;
}

function removeDoctype(source: string): string {
  return source.replace(/<!DOCTYPE[^>]*>/i, '').trimStart();
}
