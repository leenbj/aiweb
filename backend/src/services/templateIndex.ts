import { prisma } from '../database';
import { searchMemoryTemplates } from './templateMemory';

export interface SearchParams { query?: string; type?: string; tags?: string[]; engine?: string; limit?: number; offset?: number }

export async function searchTemplates(params: SearchParams) {
  const { query, type, tags, engine, limit = 20, offset = 0 } = params || {};
  const where: any = {};
  if (type) where.type = type;
  if (engine) where.engine = engine;
  if (tags && tags.length) where.tags = { hasSome: tags };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
      { tags: { has: query } },
    ];
  }
  const takeN = Math.max(limit + offset, 50);
  try {
    const total = await prisma.template.count({ where });
    const raw = await prisma.template.findMany({ where, orderBy: { updatedAt: 'desc' }, take: takeN });
    const items = rankTemplates(raw, query).slice(offset, offset + limit);
    return { items, total };
  } catch {
    const r = searchMemoryTemplates({ query, type, engine, limit: takeN, offset: 0 });
    const items = rankTemplates(r.items as any, query).slice(offset, offset + limit);
    return { items, total: (r as any).total || items.length } as any;
  }
}

function rankTemplates(list: Array<{ name?: string; slug: string; description?: string; tags?: string[]; engine?: string; updatedAt?: any }>, q?: string) {
  if (!q) return list.sort((a,b)=> (new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime()));
  const query = q.toLowerCase();
  const scoreOf = (t: any) => {
    let s = 0;
    const name = (t.name || '').toLowerCase();
    const slug = (t.slug || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const tags = (t.tags || []).map((x:string)=>String(x).toLowerCase());
    if (name.includes(query)) s += 10;
    if (slug.includes(query)) s += 8;
    if (desc.includes(query)) s += 4;
    if (tags.includes(query)) s += 6;
    if ((t.engine || '').toLowerCase() === 'hbs') s += 1; // 轻微提升可参数化模板
    return s;
  };
  return list
    .map(x => ({ rec: x, score: scoreOf(x) }))
    .sort((a,b) => b.score - a.score || (new Date(b.rec.updatedAt as any).getTime() - new Date(a.rec.updatedAt as any).getTime()))
    .map(x => x.rec);
}
