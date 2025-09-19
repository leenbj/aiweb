import express from 'express';

import { authenticate } from '../middleware/auth';
import { getTemplateMetrics, getAiMetrics } from '../services/metrics/templateMetricsService';
import { logger } from '../utils/logger';

function createEmptyTemplateMetrics() {
  const now = new Date().toISOString();
  return {
    range: { from: now, to: now },
    templateUsage: [],
    jobSummary: {
      QUEUED: 0,
      RUNNING: 0,
      SUCCESS: 0,
      FAILED: 0,
      ON_HOLD: 0,
      TOTAL: 0,
    },
    failureReasons: [],
  };
}

function createEmptyAiMetrics() {
  const now = new Date().toISOString();
  return {
    range: { from: now, to: now },
    latency: {
      averageMs: null,
      p95Ms: null,
      samples: 0,
    },
    statusBreakdown: {
      QUEUED: 0,
      RUNNING: 0,
      SUCCESS: 0,
      FAILED: 0,
      ON_HOLD: 0,
      TOTAL: 0,
    },
    recentRuns: [],
  };
}

const router = express.Router();

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseRangeDays(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

router.use(authenticate);

router.get('/templates', async (req, res, next) => {
  try {
    const rangeDays = parseRangeDays(req.query.rangeDays);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const metrics = await getTemplateMetrics({ rangeDays, from, to });
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('metrics.templates.error', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    res.json({ success: true, data: createEmptyTemplateMetrics(), degraded: true });
  }
});

router.get('/ai', async (req, res, next) => {
  try {
    const rangeDays = parseRangeDays(req.query.rangeDays);
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const metrics = await getAiMetrics({ rangeDays, from, to });
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('metrics.ai.error', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    res.json({ success: true, data: createEmptyAiMetrics(), degraded: true });
  }
});

export default router;
