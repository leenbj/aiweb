import type { PromptStatus } from '@prisma/client';
import { prisma } from '../../database';
import type { PromptReviewListOptions, PromptWithRelations } from './promptRepository';
import { listPromptsForReview } from './promptRepository';
import {
  assemblePromptReviewItem,
  PromptReviewItem,
  PromptReviewQuery,
  PromptReviewResponse,
  PromptReviewTemplateSummary,
} from './promptAssemblerCore';

interface TemplateRecord {
  id: string;
  slug: string;
  name: string;
  type: string;
  version: string;
  tags: string[];
  updatedAt: Date;
}

const MIN_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export async function listPromptReviewItems(query: PromptReviewQuery = {}): Promise<PromptReviewResponse> {
  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.pageSize);
  const skip = (page - 1) * pageSize;

  const repositoryOptions: PromptReviewListOptions = {
    skip,
    take: pageSize,
    status: query.status && query.status !== 'ALL' ? (query.status as PromptStatus) : undefined,
    search: query.search,
  };

  const { total, items } = await listPromptsForReview(repositoryOptions);

  const templateMap = await buildTemplateMap(items);
  const assembled = items.map((item) => assemblePromptReviewItem(item, templateMap));

  return {
    items: assembled,
    page,
    pageSize,
    total,
    hasNextPage: skip + items.length < total,
  };
}

function normalizePage(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

function normalizePageSize(value?: number) {
  if (!value || Number.isNaN(value)) return MIN_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.floor(value)));
}

async function buildTemplateMap(prompts: PromptWithRelations[]) {
  const templateIds = new Set<string>();
  for (const prompt of prompts) {
    for (const job of prompt.pipelineJobs) {
      for (const templateId of job.templateIds) {
        if (templateId) {
          templateIds.add(templateId);
        }
      }
    }
  }

  if (!templateIds.size) {
    return new Map<string, PromptReviewTemplateSummary>();
  }

  const records = await prisma.template.findMany({
    where: { id: { in: Array.from(templateIds) } },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      version: true,
      tags: true,
      updatedAt: true,
    },
  });

  const summaries = records.map(toTemplateSummary);
  return new Map<string, PromptReviewTemplateSummary>(summaries.map((summary) => [summary.id, summary]));
}

function toTemplateSummary(record: TemplateRecord): PromptReviewTemplateSummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    type: record.type,
    version: record.version,
    tags: record.tags,
    updatedAt: new Date(record.updatedAt).toISOString(),
    previewUrl: `/api/templates/${record.slug}`,
  };
}

export { assemblePromptReviewItem } from './promptAssemblerCore';
export type {
  PromptReviewItem,
  PromptReviewQuery,
  PromptReviewResponse,
  PromptReviewTemplateSummary,
} from './promptAssemblerCore';
