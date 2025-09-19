import { prisma } from '../../database';
import type {
  UiPrompt,
  PromptGenerationRun,
  TemplatePipelineJob,
  PromptStatus,
  PipelineStatus,
  ImportType,
  PromptSource,
  Prisma,
} from '@prisma/client';

export interface CreateUiPromptInput {
  id: string;
  name: string;
  rawText: string;
  tags: string[];
  status: PromptStatus;
  source: PromptSource;
}

export interface CreatePromptGenerationRunInput {
  id: string;
  promptId: string;
  status: PipelineStatus;
}

export interface CreateTemplatePipelineJobInput {
  id: string;
  promptId: string;
  importType: ImportType;
  status: PipelineStatus;
  templateIds?: string[];
  versionIds?: string[];
  metadata?: unknown;
}

export interface PromptReviewListOptions {
  status?: PromptStatus;
  search?: string;
  skip: number;
  take: number;
}

export async function findPromptByName(name: string): Promise<UiPrompt | null> {
  return prisma.uiPrompt.findUnique({ where: { name } });
}

export async function findPromptById(id: string): Promise<UiPrompt | null> {
  return prisma.uiPrompt.findUnique({ where: { id } });
}

export async function createPrompt(data: CreateUiPromptInput): Promise<UiPrompt> {
  return prisma.uiPrompt.create({ data });
}

export async function createPromptGenerationRun(data: CreatePromptGenerationRunInput): Promise<PromptGenerationRun> {
  return prisma.promptGenerationRun.create({ data });
}

export async function createTemplatePipelineJob(data: CreateTemplatePipelineJobInput): Promise<TemplatePipelineJob> {
  return prisma.templatePipelineJob.create({
    data: {
      templateIds: [],
      versionIds: [],
      metadata: null,
      ...data,
    },
  });
}

export async function updatePromptLatestJob(promptId: string, jobId: string) {
  await prisma.uiPrompt.update({ where: { id: promptId }, data: { latestJobId: jobId } });
}

export async function updatePromptStatus(promptId: string, status: PromptStatus) {
  await prisma.uiPrompt.update({ where: { id: promptId }, data: { status } });
}

export async function getPromptWithRelations(promptId: string) {
  return prisma.uiPrompt.findUnique({
    where: { id: promptId },
    include: {
      generationRuns: {
        orderBy: { createdAt: 'desc' },
      },
      pipelineJobs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function getLatestPipelineJob(promptId: string) {
  return prisma.templatePipelineJob.findFirst({
    where: { promptId },
    orderBy: { createdAt: 'desc' },
  });
}

function buildPromptReviewWhere(options: PromptReviewListOptions): Prisma.UiPromptWhereInput {
  const where: Prisma.UiPromptWhereInput = {};

  if (options.status) {
    where.status = options.status;
  }

  const search = options.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
      { rawText: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listPromptsForReview(options: PromptReviewListOptions) {
  const { skip, take } = options;
  const where = buildPromptReviewWhere(options);

  const [total, items] = await prisma.$transaction([
    prisma.uiPrompt.count({ where }),
    prisma.uiPrompt.findMany({
      where,
      include: {
        generationRuns: {
          orderBy: { createdAt: 'desc' },
        },
        pipelineJobs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return { total, items };
}

export type PromptWithRelations = Awaited<ReturnType<typeof listPromptsForReview>>['items'][number];
