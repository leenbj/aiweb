import type { PromptWithRelations } from './promptRepository';

export interface PromptReviewTemplateSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  version: string;
  tags: string[];
  updatedAt: string;
  previewUrl: string;
}

export interface PromptReviewTemplateLink extends Partial<PromptReviewTemplateSummary> {
  id: string;
  missing?: boolean;
}

export interface PromptReviewJobSummary {
  id: string;
  status: string;
  importType: string;
  retryCount: number;
  templateIds: string[];
  versionIds: string[];
  metadata?: Record<string, any> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  templates: PromptReviewTemplateLink[];
}

export interface PromptReviewItem {
  prompt: {
    id: string;
    name: string;
    rawText?: string;
    tags: string[];
    status: string;
    source: string;
    targetSlug?: string | null;
    latestJobId?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  latestRun: {
    id: string;
    status: string;
    errorMessage?: string | null;
    artifactPath?: string | null;
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
  } | null;
  latestJob: {
    id: string;
    status: string;
    importType: string;
    retryCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
  } | null;
  jobs: PromptReviewJobSummary[];
  templateSummaries: PromptReviewTemplateSummary[];
  templateSlugs: string[];
  previewUrls: string[];
  patchDownloadUrls: string[];
  artifactPath?: string | null;
  statistics: {
    totalRuns: number;
    totalJobs: number;
  };
}

export function assemblePromptReviewItem(
  prompt: PromptWithRelations,
  templateMap: Map<string, PromptReviewTemplateSummary>,
): PromptReviewItem {
  const latestRun = prompt.generationRuns[0] ?? null;
  const latestJob = prompt.pipelineJobs[0] ?? null;

  const jobs = prompt.pipelineJobs.map((job) => {
    const metadata = (job.metadata ?? undefined) as Record<string, any> | undefined;
    const linkedTemplates = job.templateIds.map((templateId) => {
      const summary = templateMap.get(templateId);
      if (summary) {
        return summary;
      }
      return { id: templateId, missing: true } satisfies PromptReviewTemplateLink;
    });

    return {
      id: job.id,
      status: job.status,
      importType: job.importType,
      retryCount: job.retryCount,
      templateIds: job.templateIds,
      versionIds: job.versionIds,
      metadata: metadata ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      templates: linkedTemplates,
    } satisfies PromptReviewJobSummary;
  });

  const templateSummaries = dedupeSummaries(jobs, templateMap);
  const templateSlugs = templateSummaries.map((summary) => summary.slug);

  const previewUrls = Array.from(
    new Set(
      templateSummaries.map((summary) => summary.previewUrl).filter(Boolean).concat(collectPreviewUrlsFromMetadata(jobs)),
    ),
  );

  const patchDownloadUrls = Array.from(new Set(collectPatchUrlsFromMetadata(jobs)));

  return {
    prompt: {
      id: prompt.id,
      name: prompt.name,
      rawText: prompt.rawText,
      tags: prompt.tags,
      status: prompt.status,
      source: prompt.source,
      targetSlug: prompt.targetSlug,
      latestJobId: prompt.latestJobId,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
    },
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          errorMessage: latestRun.errorMessage,
          artifactPath: latestRun.artifactPath ?? null,
          startedAt: latestRun.startedAt ?? null,
          finishedAt: latestRun.finishedAt ?? null,
        }
      : null,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          importType: latestJob.importType,
          retryCount: latestJob.retryCount,
          createdAt: latestJob.createdAt,
          updatedAt: latestJob.updatedAt,
        }
      : null,
    jobs,
    templateSummaries,
    templateSlugs,
    previewUrls,
    patchDownloadUrls,
    artifactPath: latestRun?.artifactPath ?? null,
    statistics: {
      totalRuns: prompt.generationRuns.length,
      totalJobs: prompt.pipelineJobs.length,
    },
  };
}

export function dedupeSummaries(
  jobs: PromptReviewJobSummary[],
  templateMap: Map<string, PromptReviewTemplateSummary>,
): PromptReviewTemplateSummary[] {
  const visited = new Set<string>();
  const summaries: PromptReviewTemplateSummary[] = [];
  for (const job of jobs) {
    for (const id of job.templateIds) {
      if (!id || visited.has(id)) continue;
      const summary = templateMap.get(id);
      if (summary) {
        summaries.push(summary);
        visited.add(id);
      }
    }
  }
  return summaries;
}

export function collectPreviewUrlsFromMetadata(jobs: PromptReviewJobSummary[]) {
  const urls: string[] = [];
  for (const job of jobs) {
    const meta = job.metadata;
    if (meta && typeof meta === 'object') {
      const preview = (meta as Record<string, any>).previewPath || (meta as Record<string, any>).previewUrl;
      if (typeof preview === 'string' && preview.trim()) {
        urls.push(preview.trim());
      }
    }
  }
  return urls;
}

export function collectPatchUrlsFromMetadata(jobs: PromptReviewJobSummary[]) {
  const urls: string[] = [];
  for (const job of jobs) {
    const meta = job.metadata;
    if (meta && typeof meta === 'object') {
      const patch = (meta as Record<string, any>).packagePatchPath || (meta as Record<string, any>).patchDownloadPath;
      if (typeof patch === 'string' && patch.trim()) {
        urls.push(patch.trim());
      }
    }
  }
  return urls;
}
