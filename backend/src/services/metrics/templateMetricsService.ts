import { prisma } from '../../database';

type PipelineStatus = import('@prisma/client').PipelineStatus;

export interface MetricsQuery {
  from?: Date;
  to?: Date;
  rangeDays?: number;
}

export interface TemplateMetricsResult {
  range: { from: string; to: string };
  templateUsage: Array<{
    templateId: string;
    slug: string;
    name: string;
    type: string;
    snapshots: number;
    lastGeneratedAt: string | null;
  }>;
  jobSummary: Record<PipelineStatus | 'TOTAL', number>;
  failureReasons: Array<{ reason: string; count: number }>;
}

export interface AiMetricsResult {
  range: { from: string; to: string };
  latency: {
    averageMs: number | null;
    p95Ms: number | null;
    samples: number;
  };
  statusBreakdown: Record<PipelineStatus | 'TOTAL', number>;
  recentRuns: Array<{
    id: string;
    status: PipelineStatus;
    durationMs: number | null;
    finishedAt: string | null;
    errorMessage?: string | null;
  }>;
}

function resolveRange(query: MetricsQuery) {
  const to = query.to ? new Date(query.to) : new Date();
  const rangeDays = query.rangeDays && query.rangeDays > 0 ? query.rangeDays : 30;
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function getTemplateMetrics(query: MetricsQuery = {}): Promise<TemplateMetricsResult> {
  const { from, to } = resolveRange(query);

  const [usageGroups, jobGroups, failureGroups] = await Promise.all([
    prisma.templateSnapshot.groupBy({
      by: ['templateId'],
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _count: { templateId: true },
      _max: { createdAt: true },
    }),
    prisma.templatePipelineJob.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _count: { _all: true },
    }),
    prisma.promptGenerationRun.groupBy({
      by: ['errorMessage'],
      where: {
        status: 'FAILED',
        errorMessage: { not: null },
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 10,
    }),
  ]);

  const templateIds = usageGroups.map((item) => item.templateId);
  const templates = templateIds.length
    ? await prisma.template.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, slug: true, name: true, type: true },
      })
    : [];

  const templateMap = new Map(templates.map((tpl) => [tpl.id, tpl]));
  const templateUsage = usageGroups
    .map((group) => {
      const template = templateMap.get(group.templateId);
      if (!template) return null;
      return {
        templateId: group.templateId,
        slug: template.slug,
        name: template.name,
        type: template.type,
        snapshots: group._count.templateId,
        lastGeneratedAt: group._max.createdAt?.toISOString() ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.snapshots - a.snapshots)
    .slice(0, 20);

  const jobSummary: Record<PipelineStatus | 'TOTAL', number> = {
    QUEUED: 0,
    RUNNING: 0,
    SUCCESS: 0,
    FAILED: 0,
    ON_HOLD: 0,
    TOTAL: 0,
  };

  for (const group of jobGroups) {
    const status = group.status as PipelineStatus;
    jobSummary[status] = group._count._all;
    jobSummary.TOTAL += group._count._all;
  }

  const failureReasons = failureGroups.map((group) => ({
    reason: group.errorMessage ?? 'UNKNOWN',
    count: group._count._all,
  }));

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    templateUsage,
    jobSummary,
    failureReasons,
  };
}

export async function getAiMetrics(query: MetricsQuery = {}): Promise<AiMetricsResult> {
  const { from, to } = resolveRange(query);

  const [runs, statusGroups] = await Promise.all([
    prisma.promptGenerationRun.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.promptGenerationRun.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _count: { _all: true },
    }),
  ]);

  const durations = runs
    .map((run) => {
      if (!run.startedAt || !run.finishedAt) return null;
      const start = run.startedAt.getTime();
      const end = run.finishedAt.getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
      return end - start;
    })
    .filter((value): value is number => typeof value === 'number');

  durations.sort((a, b) => a - b);
  const samples = durations.length;
  const averageMs = samples ? Math.round(durations.reduce((sum, value) => sum + value, 0) / samples) : null;
  const p95Index = samples ? Math.floor((samples - 1) * 0.95) : null;
  const p95Ms = p95Index !== null && samples ? durations[p95Index] : null;

  const statusBreakdown: Record<PipelineStatus | 'TOTAL', number> = {
    QUEUED: 0,
    RUNNING: 0,
    SUCCESS: 0,
    FAILED: 0,
    ON_HOLD: 0,
    TOTAL: 0,
  };

  for (const group of statusGroups) {
    const status = group.status as PipelineStatus;
    statusBreakdown[status] = group._count._all;
    statusBreakdown.TOTAL += group._count._all;
  }

  const recentRuns = runs.slice(0, 20).map((run) => {
    const durationMs = run.startedAt && run.finishedAt
      ? run.finishedAt.getTime() - run.startedAt.getTime()
      : null;
    return {
      id: run.id,
      status: run.status,
      durationMs: durationMs && durationMs > 0 ? durationMs : null,
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      errorMessage: run.errorMessage ?? undefined,
    };
  });

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    latency: {
      averageMs,
      p95Ms,
      samples,
    },
    statusBreakdown,
    recentRuns,
  };
}
