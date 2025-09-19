import type { Request, Response } from 'express';

import { getTemplateSummaries } from '../templateIndex';

const CACHE_HEADER = 'x-template-summary-cache';

export async function handleGetTemplateSummary(req: Request, res: Response) {
  const page = parseNumber(req.query.page);
  const pageSize = parseNumber(req.query.pageSize);
  const filters = {
    type: typeof req.query.type === 'string' ? req.query.type : undefined,
    tag: typeof req.query.tag === 'string' ? req.query.tag : undefined,
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
    engine: typeof req.query.engine === 'string' ? req.query.engine : undefined,
    page: page ?? undefined,
    pageSize: pageSize ?? undefined,
  };

  const summaries = await getTemplateSummaries(filters);
  if (summaries.cachedAt) {
    res.setHeader(CACHE_HEADER, summaries.cachedAt);
  }

  return res.json({
    success: true,
    data: summaries,
  });
}

function parseNumber(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
