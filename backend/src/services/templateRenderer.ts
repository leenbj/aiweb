import { logger } from '../utils/logger';
import { prisma } from '../database';
import Handlebars from 'handlebars';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { LRUCache } from 'lru-cache';
import * as cheerio from 'cheerio';
import { sanitizeHtmlCssJs } from '../utils/sanitizer';

type RenderParams = { slug: string; data?: any; theme?: string; engine?: 'hbs'|'react'|'plain' };

const cache = new LRUCache<string, any>({ max: 300 });
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schemaCache = new LRUCache<string, any>({ max: 300 });

export async function renderTemplate(_params: RenderParams) {
  const { slug, data, theme, engine } = _params;
  const tpl = await prisma.template.findUnique({ where: { slug } });
  if (!tpl) throw new Error(`Template not found: ${slug}`);
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
        const msg = (validate.errors || []).map(e => `${e.instancePath || e.schemaPath} ${e.message}`).join('; ');
        throw new Error(`Schema validation failed: ${msg}`);
      }
    }
    const compiled = cache.get(slug) || Handlebars.compile(tpl.code);
    if (!cache.has(slug)) cache.set(slug, compiled);
    let raw = compiled({ ...(data||{}), theme });
    // 注入主题 CSS 变量
    const themeCss = await getThemeCss(theme);
    if (themeCss) raw = injectThemeCss(raw, themeCss);
    const { html } = sanitizeHtmlCssJs(raw);
    return { html, meta: { slug, version: tpl.version, engine: 'hbs' } };
  }
  // plain: 原样返回，忽略 data
  {
    let raw = tpl.code;
    const themeCss = await getThemeCss(theme);
    if (themeCss) raw = injectThemeCss(raw, themeCss);
    const { html } = sanitizeHtmlCssJs(raw);
    return { html, meta: { slug, version: tpl.version, engine: 'plain' } };
  }
}

export async function composePage(_body: any) {
  const { page, components, theme } = _body || {};
  if (!page?.slug) throw new Error('page.slug is required');
  const pageTpl = await prisma.template.findUnique({ where: { slug: page.slug } });
  if (!pageTpl) throw new Error(`Template not found: ${page.slug}`);

  // 注册 partials
  const compSlugs = (components || []).map((c: any) => c.slug);
  const compRecords = await prisma.template.findMany({ where: { slug: { in: compSlugs } } });
  for (const t of compRecords) {
    Handlebars.registerPartial(t.slug, t.code);
  }

  if ((pageTpl.engine || 'plain').toLowerCase() === 'hbs') {
    const compiled = cache.get(pageTpl.slug) || Handlebars.compile(pageTpl.code);
    if (!cache.has(pageTpl.slug)) cache.set(pageTpl.slug, compiled);
    // 传入数据，以 slot 为 key
    const data: any = {};
    for (const c of components || []) data[c.slot || c.slug] = c.data || {};
    let raw = compiled({ ...(page.data || {}), ...data, theme });
    const themeCss = await getThemeCss(theme);
    if (themeCss) raw = injectThemeCss(raw, themeCss);
    const { html } = sanitizeHtmlCssJs(raw);
    return { html, meta: { slug: pageTpl.slug, engine: 'hbs' } };
  }

  // plain：拼接组件渲染结果
  const rendered: string[] = [];
  for (const c of components || []) {
    const r = await renderTemplate({ slug: c.slug, data: c.data, theme });
    rendered.push(r.html);
  }
  {
    let raw = rendered.join('\n');
    const themeCss = await getThemeCss(theme);
    if (themeCss) raw = injectThemeCss(raw, themeCss);
    const { html } = sanitizeHtmlCssJs(raw);
    return { html, meta: { engine: 'composed-plain' } };
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
