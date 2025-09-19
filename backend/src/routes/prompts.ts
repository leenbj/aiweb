import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import express from 'express';
import type { PromptStatus } from '@prisma/client';

import { logger } from '../utils/logger';
import { getPromptStatus, importPrompts, retryPromptImport, listPromptsForReview } from '../services/prompts/promptService';
import type { PromptPayload } from '../services/prompts/promptService';

const router = express.Router();

function normalizePayload(body: unknown): PromptPayload[] {
  if (Array.isArray(body)) {
    return body as PromptPayload[];
  }

  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as PromptPayload[];
      if (parsed && typeof parsed === 'object') return [parsed as PromptPayload];
    } catch {
      return [
        {
          name: `prompt-${Date.now()}-${randomUUID().slice(0, 6)}`,
          rawText: trimmed,
        },
      ];
    }
  }

  if (body && typeof body === 'object') {
    const payload = body as Record<string, unknown>;
    if (Array.isArray(payload.prompts)) return payload.prompts as PromptPayload[];
    if (payload.name && payload.rawText) return [payload as PromptPayload];
  }

  return [];
}

router.post('/import', async (req: Request, res: Response) => {
  try {
    const payloads = normalizePayload(req.body);
    if (!payloads.length) {
      return res.status(400).json({ success: false, error: 'Invalid prompt payload' });
    }

    const result = await importPrompts(payloads);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('prompts.import.error', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return res.status(500).json({ success: false, error: 'Failed to import prompts' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Number.parseInt(String(req.query.page ?? '1'), 10);
    const pageSize = Number.parseInt(String(req.query.pageSize ?? '20'), 10);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = statusParam && statusParam !== 'ALL' ? (statusParam as PromptStatus) : undefined;

    const data = await listPromptsForReview({
      page: Number.isNaN(page) ? undefined : page,
      pageSize: Number.isNaN(pageSize) ? undefined : pageSize,
      search,
      status,
    });

    return res.json({ success: true, data });
  } catch (error) {
    logger.error('prompts.list.error', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return res.status(500).json({ success: false, error: 'Failed to list prompts' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const data = await getPromptStatus(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    const status = (error as any)?.status || 500;
    logger.error('prompts.get.error', {
      id: req.params.id,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return res.status(status).json({ success: false, error: (error as any)?.message || 'Failed to fetch prompt' });
  }
});

router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { jobId, runId } = await retryPromptImport(req.params.id);

    return res.json({
      success: true,
      data: {
        promptId: req.params.id,
        jobId,
        runId,
      },
    });
  } catch (error) {
    const status = (error as any)?.status || 500;
    logger.error('prompts.retry.error', {
      id: req.params.id,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    return res.status(status).json({ success: false, error: (error as any)?.message || 'Failed to retry prompt import' });
  }
});

export default router;

export { normalizePayload };
