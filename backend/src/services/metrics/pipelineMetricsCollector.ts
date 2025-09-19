import { publishAlert } from '../alerts/alertPublisher';

type PipelineStatus = import('@prisma/client').PipelineStatus;

interface PipelineEvent {
  timestamp: number;
  status: 'success' | 'failure';
  stage: string;
  requestId?: string | null;
  templateSlug?: string;
  durationMs?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

const MAX_EVENTS = 200;
const events: PipelineEvent[] = [];

function recordEvent(event: PipelineEvent) {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function recordPipelineSuccess(event: {
  stage: string;
  templateSlug: string;
  durationMs?: number;
  requestId?: string;
  metadata?: Record<string, any>;
}) {
  recordEvent({
    timestamp: Date.now(),
    status: 'success',
    stage: event.stage,
    templateSlug: event.templateSlug,
    durationMs: event.durationMs,
    requestId: event.requestId,
    metadata: event.metadata,
  });
}

export function recordPipelineFailure(event: {
  stage: string;
  reason: string;
  requestId?: string;
  metadata?: Record<string, any>;
}) {
  recordEvent({
    timestamp: Date.now(),
    status: 'failure',
    stage: event.stage,
    reason: event.reason,
    requestId: event.requestId,
    metadata: event.metadata,
  });

  void publishAlert({
    severity: event.stage === 'planner' || event.stage === 'composer' ? 'critical' : 'warning',
    message: `Pipeline ${event.stage} failure: ${event.reason}`,
    context: {
      stage: event.stage,
      requestId: event.requestId,
      metadata: event.metadata,
    },
  });
}

export interface PipelineMetricsSnapshot {
  totals: {
    success: number;
    failure: number;
  };
  averageDurationMs: number | null;
  recentFailures: Array<{
    stage: string;
    reason: string;
    at: string;
  }>;
}

export function getPipelineMetricsSnapshot(windowMs = 60 * 60 * 1000): PipelineMetricsSnapshot {
  const threshold = Date.now() - windowMs;
  const windowEvents = events.filter((event) => event.timestamp >= threshold);

  const successEvents = windowEvents.filter((event) => event.status === 'success');
  const failureEvents = windowEvents.filter((event) => event.status === 'failure');

  const durations = successEvents
    .map((event) => event.durationMs)
    .filter((value): value is number => typeof value === 'number' && value > 0);

  const averageDurationMs = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  return {
    totals: {
      success: successEvents.length,
      failure: failureEvents.length,
    },
    averageDurationMs,
    recentFailures: failureEvents.slice(-5).map((event) => ({
      stage: event.stage,
      reason: event.reason || 'unknown',
      at: new Date(event.timestamp).toISOString(),
    })),
  };
}

export function getPipelineStatusBreakdown(): Record<PipelineStatus | 'TOTAL', number> {
  const breakdown: Record<PipelineStatus | 'TOTAL', number> = {
    QUEUED: 0,
    RUNNING: 0,
    SUCCESS: 0,
    FAILED: 0,
    ON_HOLD: 0,
    TOTAL: 0,
  };

  for (const event of events) {
    if (event.status === 'success') {
      breakdown.SUCCESS += 1;
      breakdown.TOTAL += 1;
    }
    if (event.status === 'failure') {
      breakdown.FAILED += 1;
      breakdown.TOTAL += 1;
    }
  }

  return breakdown;
}

