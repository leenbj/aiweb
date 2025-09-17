import { logger } from '../utils/logger';
import { prisma } from '../database';
import Handlebars from 'handlebars';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LRUCache } from 'lru-cache';
import * as cheerio from 'cheerio';
import { sanitizeHtmlCssJs } from '../utils/sanitizer';
import { getMemoryTemplateBySlug } from './templateMemory';

type RenderParams = { slug: string; data?: any; theme?: string; engine?: 'hbs'|'react'|'plain' };

type OperationContext = { requestId?: string };

const cache = new LRUCache<string, any>({ max: 300 });
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schemaCache = new LRUCache<string, any>({ max: 300 });

export async function renderTemplate(_params: RenderParams, opts: OperationContext = {}) {
  const { slug, data, theme, engine } = _params;
  const { requestId } = opts;
  const startedAt = Date.now();
  const logMeta = { requestId, slug };
  logger.info('template.render.start', logMeta);
  try {
    let tpl: any = null;
    try {
      tpl = await prisma.template.findUnique({ where: { slug } });
    } catch {
      /* ignore */
    }
    if (!tpl) {
      const mem = getMemoryTemplateBySlug(slug);
      if (mem) {
        tpl = mem;
      } else {
        const err = new Error(`Template not found: ${slug}`);
        (err as any).status = 404;
        throw err;
      }
    }
    const eng = (engine || tpl.engine || 'plain').toLowerCase();
    if (eng === 'hbs' || eng === 'handlebars') {
      if (tpl.schemaJson) {
        const key = `${tpl.slug}@${tpl.version}`;
        let validate = schemaCache.get(key);
        if (!validate) {
          validate = ajv.compile(tpl.schemaJson as any);
          schemaCache.set(key, validate);
        }
        const valid = validate(data || {});
        if (!valid) {
          const msg = (validate.errors || []).map((e: any) => `${e.instancePath || e.schemaPath} ${e.message}`).join('; ');
          const err = new Error(`Schema validation failed: ${msg}`);
          (err as any).status = 422;
          throw err;
        }
      }
      const compiled = cache.get(slug) || Handlebars.compile(tpl.code);
      if (!cache.has(slug)) cache.set(slug, compiled);
      let raw = compiled({ ...(data||{}), theme });
      const themeCss = await getThemeCss(theme);
      if (themeCss) raw = injectThemeCss(raw, themeCss);
      const { html } = sanitizeHtmlCssJs(raw);
      logger.info('template.render.success', { ...logMeta, engine: 'hbs', durationMs: Date.now() - startedAt });
      return { html, meta: { slug, version: tpl.version, engine: 'hbs' } };
    }
    {
      let raw = tpl.code;
      const themeCss = await getThemeCss(theme);
      if (themeCss) raw = injectThemeCss(raw, themeCss);
      const { html } = sanitizeHtmlCssJs(raw);
      logger.info('template.render.success', { ...logMeta, engine: 'plain', durationMs: Date.now() - startedAt });
      return { html, meta: { slug, version: tpl.version, engine: 'plain' } };
    }
  } catch (err: any) {
    logger.error('template.render.failed', { ...logMeta, error: err?.message });
    throw err;
  }
}

export async function composePage(_body: any, opts: OperationContext = {}) {
  const { page, components, theme } = _body || {};
  const { requestId } = opts;
  const logMeta = { requestId, page: page?.slug };
  const startedAt = Date.now();
  logger.info('template.compose.start', { ...logMeta, components: (components || []).length });
  try {
    if (!page?.slug) {
      const err = new Error('page.slug is required');
      (err as any).status = 400;
      throw err;
    }
    let pageTpl: any = null;
    try {
      pageTpl = await prisma.template.findUnique({ where: { slug: page.slug } });
    } catch { /* ignore */ }
    if (!pageTpl) {
      const mem = getMemoryTemplateBySlug(page.slug);
      if (mem) pageTpl = mem;
    }
    if (!pageTpl) {
      const err = new Error(`Template not found: ${page.slug}`);
      (err as any).status = 404;
      throw err;
    }

    const compSlugs = (components || []).map((c: any) => c.slug);
    let compRecords: any[] = [];
    try {
      compRecords = await prisma.template.findMany({ where: { slug: { in: compSlugs } } });
    } catch { compRecords = []; }
    const got = new Set((compRecords || []).map((t:any)=>t.slug));
    for (const s of compSlugs) {
      if (!got.has(s)) {
        const mem = getMemoryTemplateBySlug(s);
        if (mem) compRecords.push(mem as any);
      }
    }
    for (const t of compRecords) {
      Handlebars.registerPartial(t.slug, t.code);
    }

    if ((pageTpl.engine || 'plain').toLowerCase() === 'hbs') {
      const compiled = cache.get(pageTpl.slug) || Handlebars.compile(pageTpl.code);
      if (!cache.has(pageTpl.slug)) cache.set(pageTpl.slug, compiled);
      const data: any = {};
      for (const c of components || []) data[c.slot || c.slug] = c.data || {};
      let raw = compiled({ ...(page.data || {}), ...data, theme });
      const themeCss = await getThemeCss(theme);
      if (themeCss) raw = injectThemeCss(raw, themeCss);
      const { html } = sanitizeHtmlCssJs(raw);
      logger.info('template.compose.success', { ...logMeta, engine: 'hbs', durationMs: Date.now() - startedAt });
      return { html, meta: { slug: pageTpl.slug, engine: 'hbs' } };
    }

    const rendered: string[] = [];
    for (const c of components || []) {
      const r = await renderTemplate({ slug: c.slug, data: c.data, theme }, opts);
      rendered.push(r.html);
    }
    {
      let raw = rendered.join('\n');
      const themeCss = await getThemeCss(theme);
      if (themeCss) raw = injectThemeCss(raw, themeCss);
      const { html } = sanitizeHtmlCssJs(raw);
      logger.info('template.compose.success', { ...logMeta, engine: 'composed-plain', durationMs: Date.now() - startedAt });
      return { html, meta: { engine: 'composed-plain' } };
    }
  } catch (err: any) {
    logger.error('template.compose.failed', { ...logMeta, error: err?.message });
    throw err;
  }
}

// 根据 theme slug 读取主题 tokens，生成可注入的 :root 样式
async function getThemeCss(theme?: string | null) {
  if (!theme) return '';
  try {
    const rec = await prisma.template.findFirst({ where: { slug: theme, type: 'theme' } });
    const tokens = (rec?.tokensJson || {}) as Record<string, any>;
    if (tokens && Object.keys(tokens).length) {
      const cssVars = Object.keys(tokens).map(k => `  --${k}: ${tokens[k]};`).join('\n');
      return `:root{\n${cssVars}\n}`;
    }
    return rec?.code || '';
  } catch {
    return '';
  }
}

// 将主题样式注入 HTML 的 <head>，若无 head 则前置 style 块
function injectThemeCss(html: string, css: string) {
  if (!css) return html;
  try {
    const $ = cheerio.load(html);
    if ($('head').length) {
      $('head').append(`<style data-theme="tokens">${css}</style>`);
      return $.html();
    }
    return `<style data-theme="tokens">${css}</style>` + html;
  } catch {
    // 退化为字符串拼接
    const idx = html.indexOf('</head>');
    if (idx !== -1) return html.slice(0, idx) + `<style data-theme="tokens">${css}</style>` + html.slice(idx);
    return `<style data-theme="tokens">${css}</style>` + html;
  }
}
