import { createHash } from 'crypto';
import punycode from 'punycode';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';

type BtPayload = Record<string, string | number | boolean>;

function md5(input: string) {
  return createHash('md5').update(input).digest('hex');
}

function toForm(data: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => params.append(k, String(v)));
  return params;
}

async function btCall<T = any>(apiPath: string, payload: BtPayload = {}): Promise<T> {
  if (!config.baota.url || !config.baota.apiKey) {
    throw new Error('Baota API not configured');
  }
  const now = Math.floor(Date.now() / 1000);
  const token = md5(config.baota.apiKey + now);
  const url = `${config.baota.url.replace(/\/$/, '')}/api/${apiPath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({ ...payload, request_time: now, request_token: token }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === false) {
    const msg = data?.msg || `BT API ${apiPath} failed`;
    throw new Error(msg);
  }
  return data as T;
}

function toASCII(domain: string) {
  try {
    const parts = domain.split('.')
      .map(p => (/[^\x00-\x7F]/.test(p) ? punycode.toASCII(p) : p));
    return parts.join('.');
  } catch (e) {
    return domain;
  }
}

export const baotaService = {
  async ensureSite(domain: string, root: string) {
    // 创建站点（若已存在，BT一般返回已存在提示，捕获并继续）
    try {
      await btCall('site/addsite', {
        webname: JSON.stringify({ domain: domain, domainlist: [domain], count: 0 }),
        path: root,
        type: 'PHP',
        version: '00',
        port: 80,
        ps: `site-${domain}`,
      });
    } catch (e: any) {
      logger.warn(`Baota addsite warning: ${e.message}`);
    }
  },

  async bindDomain(siteName: string, domain: string) {
    try {
      await btCall('site/adddomain', { sitename: siteName, domain: domain, port: 80 });
    } catch (e: any) {
      logger.warn(`Baota adddomain warning: ${e.message}`);
    }
  },

  async applySSL(siteName: string, domains: string[]) {
    try {
      await btCall('ssl/apply_cert', {
        siteName: siteName,
        domains: JSON.stringify(domains),
        type: 'letsencrypt',
        force_renew: 0,
      });
      await btCall('site/https', { sitename: siteName, http: 1, type: 1 });
      return true;
    } catch (e: any) {
      logger.warn(`Baota apply_ssl warning: ${e.message}`);
      return false;
    }
  },

  async stopSite(siteName: string) {
    try {
      await btCall('site/stop', { id: siteName });
      await btCall('site/https', { sitename: siteName, http: 1, type: 0 });
    } catch (e: any) {
      logger.warn(`Baota stop site warning: ${e.message}`);
    }
  },

  async writeStatic(root: string, domain: string, html: string) {
    await fs.mkdir(root, { recursive: true });
    const index = path.join(root, 'index.html');
    await fs.writeFile(index, html, 'utf8');
    const robots = `User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml`;
    await fs.writeFile(path.join(root, 'robots.txt'), robots, 'utf8');
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://${domain}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`;
    await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
  },

  async deploy(websiteId: string, inputDomain: string, html: string) {
    const ascii = toASCII(inputDomain.trim());
    const root = path.join(config.server.sitesPath, ascii);
    const siteName = ascii; // 以域名作为站点标识

    await this.ensureSite(ascii, root);
    await this.bindDomain(siteName, ascii);
    await this.writeStatic(root, ascii, html);
    const sslOk = await this.applySSL(siteName, [ascii, `www.${ascii}`]);
    return { asciiDomain: ascii, root, sslOk };
  },
};
