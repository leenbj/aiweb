import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { composePage } from './templateRenderer';
import { sanitizeHtmlCssJs } from '../utils/sanitizer';
import { ensureRelative, contentHash } from '../utils/file';
import { config } from '../config';

export interface BuildInput {
  websiteId: string;
  pages: Array<{ path: string; pageSlug?: string; components?: any[]; theme?: string; data?: any; rawHtml?: string }>;
  assets?: Array<{ from: string; to: string }>;
  sitemap?: boolean;
  robots?: boolean;
  fingerprint?: boolean;
}

export async function buildStaticSite(input: BuildInput) {
  const root = path.resolve(process.env.SITES_ROOT || config.server.sitesPath || './sites');
  const base = path.resolve(root, ensureRelative(input.websiteId));
  await fs.mkdir(base, { recursive: true });

  const files: string[] = [];
  const mapping: Record<string, string> = {};

  // 复制资源
  for (const a of input.assets || []) {
    try {
      const relTo = ensureRelative(a.to);
      let finalRel = relTo;
      // from 可能是URL路径，如 /uploads/...
      let fromPath = a.from;
      if (fromPath.startsWith('/uploads/')) {
        const uploadsRoot = path.resolve(process.env.UPLOADS_ROOT || process.env.UPLOAD_PATH || './uploads');
        fromPath = path.resolve(uploadsRoot, ensureRelative(fromPath.replace(/^\/?uploads\//,'')));
      }
      const buf = await fs.readFile(fromPath);
      // 指纹化
      if (input.fingerprint) {
        const ext = path.extname(relTo);
        const name = path.basename(relTo, ext);
        const h = contentHash(buf);
        finalRel = path.join(path.dirname(relTo), `${name}.${h}${ext}`).replace(/\\/g,'/');
      }
      const out = path.resolve(base, finalRel);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, buf);
      mapping[relTo] = finalRel;
      files.push(finalRel);
    } catch (e) {
      logger.warn('copy asset failed', e);
    }
  }

  for (const p of input.pages || []) {
    let html: string;
    if (p.rawHtml) {
      // 对外部传入的 rawHtml 做基础净化，避免写入恶意脚本
      html = sanitizeHtmlCssJs(p.rawHtml).html;
    } else if (p.pageSlug) {
      const res = await composePage({ page: { slug: p.pageSlug, data: p.data }, components: p.components, theme: p.theme });
      html = res.html;
    } else {
      throw new Error('Either rawHtml or pageSlug is required');
    }
    // 替换资源引用
    for (const [from,to] of Object.entries(mapping)) {
      html = html.split(from).join(to);
    }
    const rel = ensureRelative(p.path || 'index.html');
    const out = path.resolve(base, rel);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, html, 'utf8');
    files.push(rel);
  }

  // sitemap/robots（可选，简单生成）
  if (input.sitemap) {
    const urls = (input.pages||[]).map(p=>`/${p.path.replace(/^\/+/, '')}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`;
    await fs.writeFile(path.resolve(base, 'sitemap.xml'), xml, 'utf8');
    files.push('sitemap.xml');
  }
  if (input.robots) {
    await fs.writeFile(path.resolve(base, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');
    files.push('robots.txt');
  }

  return { success: true, files, previewUrl: `/preview/website/${input.websiteId}/index.html` };
}
