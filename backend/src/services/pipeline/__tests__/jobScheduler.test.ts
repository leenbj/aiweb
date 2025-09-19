#!/usr/bin/env tsx

import assert from 'assert';

import { PipelineJobScheduler, buildWeeklyReport, shouldRetryJob } from '../jobScheduler';

async function testBuildWeeklyReport() {
  const snapshot = {
    totals: { success: 6, failure: 2 },
    averageDurationMs: 1350,
    recentFailures: [
      { stage: 'planner', reason: 'schema-validation-error', at: '2025-09-18T08:00:00Z' },
    ],
  };
  const status = { SUCCESS: 6, FAILED: 2, RUNNING: 0, QUEUED: 0, ON_HOLD: 0, TOTAL: 8 } as const;
  const report = buildWeeklyReport(snapshot as any, status as any);
  assert(report.includes('成功：6'), 'report should mention success count');
  assert(report.includes('失败：2'), 'report should mention failure count');
  assert(report.includes('schema-validation-error'), 'report should list failure reason');
}

function testShouldRetryJob() {
  const oldDate = new Date(Date.now() - 60 * 60 * 1000);
  const recent = new Date();
  const threshold = new Date(Date.now() - 30 * 60 * 1000);

  assert.strictEqual(
    shouldRetryJob({ status: 'ON_HOLD', updatedAt: oldDate } as any, threshold),
    true,
    'stale ON_HOLD jobs should be retried',
  );

  assert.strictEqual(
    shouldRetryJob({ status: 'ON_HOLD', updatedAt: recent } as any, threshold),
    false,
    'recent ON_HOLD jobs should not be retried',
  );

  assert.strictEqual(
    shouldRetryJob({ status: 'SUCCESS', updatedAt: oldDate } as any, threshold),
    false,
    'non ON_HOLD jobs should not be retried',
  );
}

async function testSchedulerActions() {
  const alerts: any[] = [];
  const updates: any[] = [];
  const infoLogs: any[] = [];

  const deps = {
    prisma: {
      templatePipelineJob: {
        findMany: async () => [
          {
            id: 'job_1',
            status: 'ON_HOLD',
            retryCount: 1,
            metadata: null,
            updatedAt: new Date(Date.now() - 60 * 60 * 1000),
          },
        ],
        update: async ({ where, data }: any) => {
          updates.push({ where, data });
          return { id: where.id, ...data };
        },
      },
    },
    publishAlert: async (payload: any) => {
      alerts.push(payload);
    },
    logger: {
      info: (...args: any[]) => infoLogs.push(['info', ...args]),
      warn: (...args: any[]) => infoLogs.push(['warn', ...args]),
      error: (...args: any[]) => infoLogs.push(['error', ...args]),
    },
    getSnapshot: () => ({
      totals: { success: 5, failure: 1 },
      averageDurationMs: 1000,
      recentFailures: [],
    }),
    getStatusBreakdown: () => ({ SUCCESS: 5, FAILED: 1, RUNNING: 0, QUEUED: 0, ON_HOLD: 0, TOTAL: 6 }),
  } as any;

  const scheduler = new PipelineJobScheduler(deps, {
    staleMinutes: 30,
    retryBatchSize: 5,
  });

  await scheduler.runWeeklyReport();
  assert(alerts.some((alert) => alert.message.includes('周报')), 'weekly report should send alert');

  const retried = await scheduler.runRetryHoldJobs();
  assert.strictEqual(retried, 1, 'should retry one job');
  assert.strictEqual(updates.length, 1, 'should update job status');
  assert(alerts.some((alert) => alert.message.includes('重新入队')), 'retry should emit alert');
}

async function main() {
  await testBuildWeeklyReport();
  testShouldRetryJob();
  await testSchedulerActions();
  console.log('✅ jobScheduler tests passed');
}

void main().catch((error) => {
  console.error('❌ jobScheduler tests failed');
  console.error(error);
  process.exit(1);
});

