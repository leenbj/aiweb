import { randomUUID } from 'node:crypto';
import type { PipelineStatus, ImportType, PromptStatus, PromptSource } from '@prisma/client';

import {
  createPrompt,
  createPromptGenerationRun,
  createTemplatePipelineJob,
  findPromptByName,
  findPromptById,
  updatePromptLatestJob,
  updatePromptStatus,
  getPromptWithRelations,
  getLatestPipelineJob,
} from './promptRepository';
import { logger } from '../../utils/logger';
import { listPromptReviewItems, type PromptReviewQuery, type PromptReviewResponse } from './promptAssembler';

export type PromptPayload = {
  name: string;
  rawText: string;
  tags?: string[];
};

export interface ImportPromptsResult {
  created: Array<{ promptId: string; jobId: string; runId: string; name: string }>;
  skipped: Array<{ name: string; reason: string }>;
}

const DEFAULT_STATUS: PromptStatus = 'PENDING';
const DEFAULT_PIPELINE_STATUS: PipelineStatus = 'QUEUED';
const DEFAULT_IMPORT_TYPE: ImportType = 'PROMPT';

export async function importPrompts(payloads: PromptPayload[], opts: { source?: PromptSource } = {}): Promise<ImportPromptsResult> {
  const results: ImportPromptsResult = { created: [], skipped: [] };
  const source: PromptSource = opts.source ?? 'OPERATION';

  for (const item of payloads) {
    const trimmedName = item.name?.trim();
    const trimmedText = item.rawText?.trim();
    if (!trimmedName || !trimmedText) {
      results.skipped.push({ name: item.name || 'unknown', reason: 'name or rawText missing' });
      continue;
    }

    const existing = await findPromptByName(trimmedName);
    if (existing) {
      results.skipped.push({ name: trimmedName, reason: 'duplicate-name' });
      continue;
    }

    const promptId = randomUUID();
    const runId = randomUUID();
    const jobId = randomUUID();

    try {
      await createPrompt({
        id: promptId,
        name: trimmedName,
        rawText: trimmedText,
        tags: item.tags ?? [],
        status: DEFAULT_STATUS,
        source,
      });

      await createPromptGenerationRun({
        id: runId,
        promptId,
        status: DEFAULT_PIPELINE_STATUS,
      });

      await createTemplatePipelineJob({
        id: jobId,
        promptId,
        importType: DEFAULT_IMPORT_TYPE,
        status: DEFAULT_PIPELINE_STATUS,
      });

      await updatePromptLatestJob(promptId, jobId);

      await updatePromptStatus(promptId, DEFAULT_STATUS);

      results.created.push({ promptId, jobId, runId, name: trimmedName });
    } catch (error) {
      logger.error('prompt.import.failed', {
        name: trimmedName,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
      results.skipped.push({ name: trimmedName, reason: 'unexpected-error' });
    }
  }

  return results;
}

export async function retryPromptImport(promptId: string) {
  const prompt = await findPromptById(promptId);
  if (!prompt) {
    throw new Error('Prompt not found');
  }

  const latestJob = await getLatestPipelineJob(promptId);
  if (latestJob && ['QUEUED', 'RUNNING'].includes(latestJob.status)) {
    const error: any = new Error('Latest job still in progress');
    error.status = 409;
    throw error;
  }

  const runId = randomUUID();
  const jobId = randomUUID();

  await createPromptGenerationRun({
    id: runId,
    promptId,
    status: DEFAULT_PIPELINE_STATUS,
  });

  await createTemplatePipelineJob({
    id: jobId,
    promptId,
    importType: DEFAULT_IMPORT_TYPE,
    status: DEFAULT_PIPELINE_STATUS,
  });

  await updatePromptLatestJob(promptId, jobId);
  await updatePromptStatus(promptId, DEFAULT_STATUS);

  return { runId, jobId };
}

export async function getPromptStatus(promptId: string) {
  const prompt = await getPromptWithRelations(promptId);
  if (!prompt) {
    const error: any = new Error('Prompt not found');
    error.status = 404;
    throw error;
  }

  return {
    prompt,
    runs: prompt.generationRuns,
    jobs: prompt.pipelineJobs,
  };
}

export async function listPromptsForReview(query: PromptReviewQuery = {}): Promise<PromptReviewResponse> {
  return listPromptReviewItems(query);
}
