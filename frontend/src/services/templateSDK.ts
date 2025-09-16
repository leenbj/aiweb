import type { TemplateType, TemplateEngine } from '@/shared/types';

export interface TemplateDTO {
  id: string;
  type: TemplateType;
  name: string;
  slug: string;
  engine: TemplateEngine;
  description?: string;
  tags: string[];
  version: string;
  schemaJson?: any;
  tokensJson?: any;
  previewHtml?: string;
}

function baseURL() {
  return '/api';
}

function authHeaders(asJson = true) {
  let token = '';
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const obj = JSON.parse(raw);
      token = obj?.state?.token || '';
    }
  } catch {}
  if (!token) token = localStorage.getItem('token') || '';
  const h: Record<string, string> = {};
  if (asJson) h['Content-Type'] = 'application/json';
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
    const r = await fetch(`${baseURL()}/templates/search?${q.toString()}`, { headers: authHeaders(false) });
    return r.json() as Promise<{ items: TemplateDTO[]; total: number }>;
  }

  async get(slug: string) {
    const r = await fetch(`${baseURL()}/templates/${slug}`, { headers: authHeaders(false) });
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

  async export(templateId: string) {
    const r = await fetch(`${baseURL()}/templates/${templateId}/export`, { method: 'GET', headers: authHeaders(false) });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(text || '导出失败');
    }
    return r.blob();
  }
}

export const templateSDK = new TemplateSDK();
