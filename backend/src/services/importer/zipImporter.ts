import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

import Handlebars from 'handlebars';
import { parametrizeComponentHtml } from './hbsParametrize';
import { extractThemeTokens } from './themeExtractor';
import { addMemoryTemplate } from '../templateMemory';
import { ensureRelative } from '../../utils/file';


const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

const ALLOWED_EXTS = new Set([

  '.html', '.htm', '.css', '.js', '.mjs', '.json', '.jpg', '.jpeg', '.png', '.gif', '.svg',
  '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.txt', '.map', '.webmanifest',
]);

function isAllowedAsset(relPath: string) {
  const ext = path.extname(relPath.toLowerCase());
  if (!ext) return false;
  return ALLOWED_EXTS.has(ext);
}

function safeJoinUploads(baseDir: string, relPath: string) {
  const normalized = ensureRelative(relPath);
  return path.resolve(baseDir, normalized);
}


export interface ImportResult {
  importId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
}


export async function importZipToTemplates(zipBuffer: Buffer, userId: string, opts?: { requestId?: string }): Promise<ImportResult> {
  const importId = `imp_${uuidv4().slice(0,8)}`;

  const baseDir = path.resolve(UPLOADS_ROOT, `u_${userId}`, importId);
  await fs.mkdir(baseDir, { recursive: true });

  const requestId = opts?.requestId;
  const logMeta = { importId, userId, requestId };
  const startedAt = Date.now();

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  logger.info('zipImporter.start', { ...logMeta, entries: entries.length });

  const pages: string[] = [];
  const components: string[] = [];

  const skipped: string[] = [];
  let assetsCount = 0;
  let cssBundle = '';

  try {
    for (const e of entries) {
      if (e.isDirectory) continue;
      const relPath = e.entryName.replace(/^\/+/, '');
      const lower = relPath.toLowerCase();
      const content = e.getData();

      if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        const html = content.toString('utf8');
        const $ = cheerio.load(html);
        const title = $('title').first().text().trim();
        const baseSlug = path.basename(relPath).replace(/\.(html|htm)$/i, '');
        const name = title || baseSlug;

        const links = $('link[rel="stylesheet"]').map((_,el)=>$(el).attr('href')).get().filter(Boolean) as string[];
        const scripts = $('script[src]').map((_,el)=>$(el).attr('src')).get().filter(Boolean) as string[];

        const componentCandidates: Array<{ slug: string; el: cheerio.Cheerio }> = [];
        const headerEl = $('header').first(); if (headerEl.length) componentCandidates.push({ slug:'header', el: headerEl });
        const footerEl = $('footer').first(); if (footerEl.length) componentCandidates.push({ slug:'footer', el: footerEl });
        const heroEl = $('section.hero, .hero').first(); if (heroEl.length) componentCandidates.push({ slug:'hero', el: heroEl });
        const pricingEl = $('.pricing, section.pricing, [class*=pricing]').first(); if (pricingEl.length) componentCandidates.push({ slug:'pricing-table', el: pricingEl });
        const teamEl = $('.team, .team-grid, [class*=team]').first(); if (teamEl.length) componentCandidates.push({ slug:'team-grid', el: teamEl });
        const serviceEl = $('.service, .features, [class*=feature], [class*=service]').first(); if (serviceEl.length) componentCandidates.push({ slug:'service-list', el: serviceEl });

        for (const c of componentCandidates) {
          try {
            const htmlFragment = $.html(c.el);
            let compSlug = c.slug;
            try {
              const exists = await prisma.template.findUnique({ where: { slug: compSlug } });
              if (exists) compSlug = `${compSlug}-${uuidv4().slice(0,6)}`;
            } catch {}
            const { code: hbsCode, schemaJson } = parametrizeComponentHtml(htmlFragment);
            const sampleData = buildSampleData(schemaJson);
            let preview = tryCompile(hbsCode, sampleData);
            preview = rewriteAssets(preview, `/uploads/u_${userId}/${importId}/`);
            const baseRec = {
              type: 'component',
              name: compSlug.replace(/(^|[-_])(\w)/g, (_,p1,p2)=>p2.toUpperCase()),
              slug: compSlug,
              engine: 'hbs',
              description: `Imported component from ${relPath}`,
              code: hbsCode,
              schemaJson,
              tags: [] as string[],
              previewHtml: preview,
            };
            try {
              await prisma.template.create({ data: baseRec as any });
            } catch {
              addMemoryTemplate(baseRec);
            }
            components.push(compSlug);
          } catch (err) {
            logger.warn('zipImporter.componentFailed', { ...logMeta, file: relPath, error: (err as any)?.message });
          }
        }

        const partialCalls = componentCandidates.map(s=>`{{> ${s.slug} ${s.slug} }}`).join('\n');
        const headLinks = links.map(h=>`<link rel="stylesheet" href="${h}">`).join('\n');
        const headScripts = scripts.map(s=>`<script src="${s}"></script>`).join('\n');
        const pageHbs = `<!DOCTYPE html>`+
`<html lang="zh-CN">`+
`  <head>`+
`    <meta charset="utf-8" />`+
`    <meta name="viewport" content="width=device-width, initial-scale=1" />`+
`    <title>${name}</title>`+
`    ${headLinks}`+
`    ${headScripts}`+
`  </head>`+
`  <body>`+
`    ${partialCalls || $('body').html() || ''}`+
`  </body>`+
`</html>`;

        let finalSlug = baseSlug;
        try {
          const existing = await prisma.template.findUnique({ where: { slug: finalSlug } });
          if (existing) finalSlug = `${baseSlug}-${uuidv4().slice(0,6)}`;
        } catch {}

        const pagePreview = (() => {
          try {
            for (const c of componentCandidates) {
              const frag = $.html(c.el);
              const { code } = parametrizeComponentHtml(frag);
              Handlebars.registerPartial(c.slug, code);
            }
            const compiled = Handlebars.compile(pageHbs);
            const data: any = {};
            for (const c of componentCandidates) data[c.slug] = buildSampleData();
            let htmlOut = compiled(data);
            htmlOut = rewriteAssets(htmlOut, `/uploads/u_${userId}/${importId}/`);
            return htmlOut;
          } catch {
            return pageHbs;
          }
        })();

        const pageRec = {
          type: 'page',
          name,
          slug: finalSlug,
          engine: componentCandidates.length ? 'hbs' : 'plain',
          description: `Imported from ZIP: ${relPath}`,
          code: componentCandidates.length ? pageHbs : html,
          tags: [] as string[],
          previewHtml: componentCandidates.length ? pagePreview : rewriteAssets(html, `/uploads/u_${userId}/${importId}/`),
        };
        try {
          await prisma.template.create({ data: pageRec as any });
        } catch {
          addMemoryTemplate(pageRec);
        }
        pages.push(finalSlug);
      } else {
        if (!isAllowedAsset(relPath)) {
          skipped.push(relPath);
          logger.warn('zipImporter.skippedFile', { ...logMeta, file: relPath, reason: 'ext_not_allowed' });
          continue;
        }
        try {
          const outPath = safeJoinUploads(baseDir, relPath);
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, content);
          assetsCount++;
        } catch (err) {
          logger.error('zipImporter.assetWriteFailed', { ...logMeta, file: relPath, error: (err as any)?.message });
        }
        if (lower.endsWith('.css')) {
          try { cssBundle += content.toString('utf8') + '\n'; } catch {}
        }

      }

      pages.push(slug);
      continue;
    }

  } catch (err) {
    logger.error('zipImporter.failed', { ...logMeta, error: (err as any)?.message });
    throw err;
  }

  let themeSlug: string | undefined = undefined;
  try {
    const { tokens, css } = extractThemeTokens(cssBundle);
    if (tokens && Object.keys(tokens).length) {
      themeSlug = `theme-${importId}`;
      const themeRec = {
        type: 'theme',
        name: 'Default Theme',
        slug: themeSlug,
        engine: 'plain',
        description: `Extracted tokens from ZIP ${importId}`,
        code: css || '',
        tokensJson: tokens as any,
        tags: ['theme'] as string[],
      };
      try {
        await prisma.template.create({ data: themeRec as any });
      } catch {
        addMemoryTemplate(themeRec as any);
      }
    }
  } catch (err) {
    logger.warn('zipImporter.themeExtractFailed', { ...logMeta, error: (err as any)?.message });
  }

  const duration = Date.now() - startedAt;
  logger.info('zipImporter.success', { ...logMeta, pages: pages.length, components: components.length, assets: assetsCount, skipped: skipped.length, durationMs: duration });


  return {
    importId,
    pages,
    components,
    theme: undefined,
    assetsBase,
  };
}


function buildSampleData(schema?: any) {
  const data: any = {
    title: '示例标题',
    subtitle: '示例副标题',
    cta: { text: '立即查看', href: '#' },
    image: { src: 'https://via.placeholder.com/640x360?text=Preview', alt: '示例图片' },
  };
  if (schema && schema.properties) {
    if (schema.properties.items) {
      const itemsSchema = schema.properties.items;
      if (itemsSchema.type === 'array' && itemsSchema.items?.type === 'object') {
        data.items = [
          { name: '基础版', price: '¥99/月' },
          { name: '专业版', price: '¥199/月' },
          { name: '企业版', price: '¥399/月' },
        ];
      } else {
        data.items = ['特性一', '特性二', '特性三'];
      }
    }
  } else {
    data.items = ['特性一', '特性二', '特性三'];

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

    if ($('head').length && $('head base').length === 0) {
      $('head').prepend(`<base href="${assetsBase.replace(/\/$/, '/')}">`);
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

