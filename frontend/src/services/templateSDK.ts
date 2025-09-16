export type TemplateType = 'component'|'page'|'theme';
export type TemplateEngine = 'hbs'|'react'|'plain';

export interface TemplateDTO {
  id: string; type: TemplateType; name: string; slug: string;
  engine: TemplateEngine; description?: string; tags: string[];
  version: string; schemaJson?: any; tokensJson?: any; previewHtml?: string;
}

function baseURL() {
  // 走 vite 代理 /api
  return '/api';
}

function authHeaders() {
  // 优先从 zustand 持久化中读取
  let token = '';
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const obj = JSON.parse(raw);
      token = obj?.state?.token || '';
    }
  } catch {}
  if (!token) token = localStorage.getItem('token') || '';
  const h: Record<string,string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export class TemplateSDK {
  async search(params: {query?: string; type?: TemplateType; tags?: string[]; engine?: TemplateEngine; limit?: number; offset?: number}) {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k,v]) => {
      if (Array.isArray(v)) v.forEach(x=>q.append(k, String(x)));
      else if (v!=null) q.set(k, String(v));
    });
    const r = await fetch(`${baseURL()}/templates/search?${q.toString()}`, { headers: authHeaders() });
    return r.json() as Promise<{ items: TemplateDTO[]; total: number }>;
  }

  async get(slug: string) {
    const r = await fetch(`${baseURL()}/templates/${slug}`, { headers: authHeaders() });
    return r.json() as Promise<TemplateDTO & { code?: string }>;
  }

  async render(body: { slug: string; engine?: TemplateEngine; data?: any; theme?: string }) {
    const r = await fetch(`${baseURL()}/templates/render`, { method:'POST', headers:authHeaders(), body:JSON.stringify(body) });
    return r.json() as Promise<{ html: string; css?: string; js?: string; meta?: any }>;
  }

  async compose(body: { page: { slug: string; data?: any }; components: { slot: string; slug: string; data?: any }[]; theme?: string }) {
    const r = await fetch(`${baseURL()}/templates/compose`, { method:'POST', headers:authHeaders(), body:JSON.stringify(body) });
    return r.json() as Promise<{ html: string; css?: string; js?: string; meta?: any }>;
  }
}

export const templateSDK = new TemplateSDK();
