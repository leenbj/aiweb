import { logger } from '../../utils/logger';
import { prisma } from '../../database';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import Handlebars from 'handlebars';
import { parametrizeComponentHtml } from './hbsParametrize';
import { extractThemeTokens } from './themeExtractor';
import { addMemoryTemplate } from '../templateMemory';

const UPLOADS_ROOT = process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads';

export interface ImportResult {
  importId: string;
  pages: string[];
  components: string[];
  theme?: string;
  assetsBase?: string;
}

export async function importZipToTemplates(zipBuffer: Buffer, userId: string): Promise<ImportResult> {
  // 解压到 uploads/u<userId>/<importId>/ 原地
  const importId = `imp_${uuidv4().slice(0,8)}`;
  const baseDir = path.resolve(UPLOADS_ROOT, `u_${userId}`, importId);
  await fs.mkdir(baseDir, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const pages: string[] = [];
  const components: string[] = [];
  let cssBundle = '';

  // 简单导入策略：
  // - .html / .htm → 存入 Template(type=page, engine=plain)
  // - 其他资源写入 baseDir 供预览/构建使用
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

      // 收集 head 资源
      const links = $('link[rel="stylesheet"]').map((_,el)=>$(el).attr('href')).get().filter(Boolean) as string[];
      const scripts = $('script[src]').map((_,el)=>$(el).attr('src')).get().filter(Boolean) as string[];

      // 识别组件（启发式）
      const componentCandidates: Array<{ slug: string; el: cheerio.Cheerio }>=[];
      const headerEl = $('header').first(); if (headerEl.length) componentCandidates.push({ slug:'header', el: headerEl });
      const footerEl = $('footer').first(); if (footerEl.length) componentCandidates.push({ slug:'footer', el: footerEl });
      const heroEl = $('section.hero, .hero').first(); if (heroEl.length) componentCandidates.push({ slug:'hero', el: heroEl });
      const pricingEl = $('.pricing, section.pricing, [class*=pricing]').first(); if (pricingEl.length) componentCandidates.push({ slug:'pricing-table', el: pricingEl });
      const teamEl = $('.team, .team-grid, [class*=team]').first(); if (teamEl.length) componentCandidates.push({ slug:'team-grid', el: teamEl });
      const serviceEl = $('.service, .features, [class*=feature], [class*=service]').first(); if (serviceEl.length) componentCandidates.push({ slug:'service-list', el: serviceEl });

      // 入库组件模板（hbs）
      for (const c of componentCandidates) {
        const htmlFragment = $.html(c.el);
        let compSlug = c.slug;
        try {
          const exists = await prisma.template.findUnique({ where: { slug: compSlug } });
          if (exists) compSlug = `${compSlug}-${uuidv4().slice(0,6)}`;
        } catch {}
        const { code: hbsCode, schemaJson } = parametrizeComponentHtml(htmlFragment);
        // 使用示例数据渲染预览，并重写相对资源为绝对uploads路径
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
      }

      // 生成 page.hbs 骨架，包含 head 资源与 partial 插槽
      const partialCalls = components.map(s=>`{{> ${s} ${s} }}`).join('\n');
      const headLinks = links.map(h=>`<link rel="stylesheet" href="${h}">`).join('\n');
      const headScripts = scripts.map(s=>`<script src="${s}"></script>`).join('\n');
      const pageHbs = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
    ${headLinks}
    ${headScripts}
  </head>
  <body>
    ${partialCalls || $('body').html() || ''}
  </body>
</html>`;

      // 入库 page 模板（若无识别组件则作为 plain 回退）
      let finalSlug = baseSlug;
      try {
        const existing = await prisma.template.findUnique({ where: { slug: finalSlug } });
        if (existing) finalSlug = `${baseSlug}-${uuidv4().slice(0,6)}`;
      } catch {}
      // 生成page预览：注册partials并用示例数据编译，然后重写资源为uploads路径
      const pagePreview = (() => {
        try {
          // 注册partials（注意：以最新的 compSlug 列表为准）
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
        engine: components.length ? 'hbs' : 'plain',
        description: `Imported from ZIP: ${relPath}`,
        code: components.length ? pageHbs : html,
        tags: [] as string[],
        previewHtml: components.length ? pagePreview : rewriteAssets(html, `/uploads/u_${userId}/${importId}/`),
      };
      try {
        await prisma.template.create({ data: pageRec as any });
      } catch {
        addMemoryTemplate(pageRec);
      }
      pages.push(finalSlug);
    } else {
      // 写入静态资源
      const outPath = path.resolve(baseDir, relPath);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, content);
      // 收集 CSS 内容用于主题抽取
      if (lower.endsWith('.css')) {
        try { cssBundle += content.toString('utf8') + '\n'; } catch {}
      }
    }
  }

  // 主题 Token 抽取与入库（可选）
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
  } catch {}

  return {
    importId,
    pages,
    components,
    theme: themeSlug || 'default',
    assetsBase: `/uploads/u_${userId}/${importId}/`,
  };
}

function buildSampleData(schema?: any) {
  // 简易示例数据，覆盖常见键
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
  return data;
}

function tryCompile(hbsCode: string, ctx: any) {
  try {
    const compiled = Handlebars.compile(hbsCode);
    return compiled(ctx);
  } catch {
    return hbsCode;
  }
}

function rewriteAssets(html: string, assetsBase: string) {
  try {
    const $ = cheerio.load(html);
    $('link[rel="stylesheet"][href], script[src], img[src]').each((_, el) => {
      const $el = $(el);
      const attr = $el.is('link') ? 'href' : 'src';
      const val = $el.attr(attr) || '';
      if (!val || /^https?:/i.test(val) || /^data:/i.test(val) || val.startsWith('/uploads/')) return;
      const clean = val.replace(/^\.?\//, '').replace(/^\//, '');
      $el.attr(attr, assetsBase.replace(/\/$/, '/') + clean);
    });
    // 注入 <base>，以便其它相对资源解析
    if ($('head').length && $('head base').length === 0) {
      $('head').prepend(`<base href="${assetsBase.replace(/\/$/, '/')}">`);
    }
    return $.html();
  } catch {
    return html;
  }
}
