import { searchMemoryTemplates } from './templateMemory';
import { logger } from '../utils/logger';
import type { TemplateSummary } from '@/shared/types';

export interface SearchParams {
  query?: string;
  type?: string;
  tags?: string[];
  engine?: string;
  limit?: number;
  offset?: number;
}

export interface TemplateSummaryFilters {
  type?: string;
  tag?: string;
  keyword?: string;
  engine?: string;
  page?: number;
  pageSize?: number;
}

export interface TemplateSummaryResult {
  items: TemplateSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  cachedAt: string | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;
const MIN_PAGE_SIZE = 10;
const SUMMARY_CACHE_TTL_MS_DEFAULT = 5 * 60 * 1000;

type SummaryCache = { data: TemplateSummary[]; fetchedAt: number };

let summaryCache: SummaryCache | null = null;
let summaryCachePromise: Promise<TemplateSummary[]> | null = null;
let summaryCacheTtlMs = SUMMARY_CACHE_TTL_MS_DEFAULT;
let prismaClient: any = null;
let loadPrismaClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require('../database');
  return prisma;
};

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
    const prisma = getPrisma();
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

export async function getTemplateSummaries(filters: TemplateSummaryFilters = {}): Promise<TemplateSummaryResult> {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;

  const data = await ensureSummaryCache();
  const filtered = applySummaryFilters(data, filters);
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    hasNextPage: offset + pageSize < filtered.length,
    cachedAt: summaryCache ? new Date(summaryCache.fetchedAt).toISOString() : null,
  };
}

type RefreshOptions = {
  reason?: string;
  importId?: string;
  requestId?: string;
  templateId?: string;
};

type RefreshExecutor = (context: RefreshOptions) => Promise<void>;

export async function refreshTemplateSummaryCache() {
  await ensureSummaryCache(true);
}

let refreshExecutor: RefreshExecutor = defaultRefreshExecutor;

export async function refreshTemplateIndex(context: RefreshOptions = {}) {
  await refreshExecutor(context);
}

async function defaultRefreshExecutor(context: RefreshOptions = {}) {
  try {
    logger.info('templateIndex.refresh', {
      reason: context.reason || 'manual',
      importId: context.importId,
      templateId: context.templateId,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    });
    await refreshTemplateSummaryCache();
  } catch (error) {
    logger.warn('templateIndex.refresh.failed', {
      reason: context.reason,
      importId: context.importId,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    throw error;
  }
}

export async function onTemplateImported(event: { templateId?: string; importId?: string; requestId?: string } = {}) {
  try {
    await refreshTemplateIndex({
      reason: 'template-imported',
      templateId: event.templateId,
      importId: event.importId,
      requestId: event.requestId,
    });
    logger.info('templateIndex.templateImported', {
      templateId: event.templateId,
      importId: event.importId,
      requestId: event.requestId,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('templateIndex.templateImported.failed', {
      templateId: event.templateId,
      importId: event.importId,
      requestId: event.requestId,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
  }
}

function rankTemplates(list: Array<{ name?: string; slug: string; description?: string | null; tags?: string[]; engine?: string; updatedAt?: any }>, q?: string) {
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

async function ensureSummaryCache(force = false) {
  if (force) {
    summaryCache = null;
  }

  if (summaryCache) {
    const age = Date.now() - summaryCache.fetchedAt;
    if (age < summaryCacheTtlMs) {
      return summaryCache.data;
    }
  }

  if (summaryCachePromise) {
    return summaryCachePromise;
  }

  summaryCachePromise = loadTemplateSummaries()
    .then((data) => {
      summaryCache = { data, fetchedAt: Date.now() };
      summaryCachePromise = null;
      return data;
    })
    .catch((error) => {
      summaryCachePromise = null;
      throw error;
    });

  return summaryCachePromise;
}

async function loadTemplateSummaries(): Promise<TemplateSummary[]> {
  const prisma = getPrisma();
  const templates = await prisma.template.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      engine: true,
      version: true,
      tags: true,
      description: true,
      schemaJson: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return templates.map((record) => buildTemplateSummary(record));
}

function buildTemplateSummary(record: {
  id: string;
  slug: string;
  name: string;
  type: string;
  engine: string;
  version: string;
  tags: string[];
  description: string | null;
  schemaJson: unknown;
  updatedAt: Date;
}): TemplateSummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    type: record.type,
    engine: record.engine,
    version: record.version,
    tags: record.tags,
    summary: deriveSummary(record.description, record.tags),
    keyFields: deriveKeyFields(record.schemaJson),
    updatedAt: new Date(record.updatedAt).toISOString(),
  };
}

function deriveSummary(description?: string | null, tags: string[] = []) {
  const trimmed = description?.trim();
  if (trimmed) {
    return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
  }
  if (tags.length) {
    return `相关标签：${tags.join(', ')}`;
  }
  return '暂无摘要';
}

function deriveKeyFields(schemaJson: unknown): string[] {
  if (!schemaJson || typeof schemaJson !== 'object') return [];
  const schema = schemaJson as { properties?: Record<string, any> };
  if (!schema.properties || typeof schema.properties !== 'object') return [];
  return Object.keys(schema.properties).slice(0, 8);
}

function applySummaryFilters(data: TemplateSummary[], filters: TemplateSummaryFilters) {
  let results = data;

  if (filters.type) {
    results = results.filter((item) => item.type === filters.type);
  }

  if (filters.engine) {
    results = results.filter((item) => item.engine === filters.engine);
  }

  if (filters.tag) {
    const tagLower = filters.tag.toLowerCase();
    results = results.filter((item) => item.tags.some((tag) => tag.toLowerCase() === tagLower));
  }

  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    results = results.filter((item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.slug.toLowerCase().includes(keyword) ||
      item.summary.toLowerCase().includes(keyword) ||
      item.tags.some((tag) => tag.toLowerCase().includes(keyword)),
    );
  }

  return results;
}

function normalizePage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

function normalizePageSize(value?: number) {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  const size = Math.floor(value);
  if (size < MIN_PAGE_SIZE) return MIN_PAGE_SIZE;
  if (size > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return size;
}

function getPrisma() {
  if (!prismaClient) {
    prismaClient = loadPrismaClient();
  }
  return prismaClient;
}

export const __testing = {
  resetCache() {
    summaryCache = null;
    summaryCachePromise = null;
  },
  setCacheTtl(ms: number) {
    summaryCacheTtlMs = ms;
  },
  setPrismaClient(client: any) {
    prismaClient = client;
    loadPrismaClient = () => client;
  },
  resetPrismaClient() {
    prismaClient = null;
    loadPrismaClient = () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require('../database');
      return prisma;
    };
  },
  setRefreshExecutor(executor: RefreshExecutor) {
    refreshExecutor = executor;
  },
  resetRefreshExecutor() {
    refreshExecutor = defaultRefreshExecutor;
  },
};
