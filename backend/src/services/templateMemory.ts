export interface MemoryTemplate {
  id: string;
  type: string;
  name: string;
  slug: string;
  engine: string;
  description?: string;
  code: string;
  schemaJson?: any;
  tokensJson?: any;
  tags: string[];
  version: string;
  previewHtml?: string;
  updatedAt: string;
}

const memoryTemplates: MemoryTemplate[] = [];

export function addMemoryTemplate(t: Omit<MemoryTemplate, 'id' | 'updatedAt' | 'version'> & { version?: string }) {
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const version = t.version || '1.0.0';
  const updatedAt = new Date().toISOString();
  const rec: MemoryTemplate = { id, version, updatedAt, ...t } as any;
  memoryTemplates.push(rec);
  return rec;
}

export function searchMemoryTemplates(params: { query?: string; type?: string; engine?: string; limit?: number; offset?: number }) {
  const { query, type, engine, limit = 20, offset = 0 } = params || {};
  let list = memoryTemplates.slice().sort((a,b)=> (a.updatedAt < b.updatedAt ? 1 : -1));
  if (type) list = list.filter(t => t.type === type);
  if (engine) list = list.filter(t => t.engine === engine);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(t => (t.name||'').toLowerCase().includes(q) || (t.slug||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
  }
  const total = list.length;
  const items = list.slice(offset, offset + limit);
  return { items, total };
}

export function getMemoryTemplateBySlug(slug: string) {
  return memoryTemplates.find(t => t.slug === slug) || null;
}

export function getMemoryTemplateById(id: string) {
  return memoryTemplates.find(t => t.id === id) || null;
}
