#!/usr/bin/env tsx

import assert from 'assert';

import { prisma } from '../src/database';
import { getTemplateMetrics, getAiMetrics } from '../src/services/metrics/templateMetricsService';

type GroupResult<T> = T extends (...args: any[]) => Promise<infer R> ? R : never;

async function withPatchedPrisma<T>(patch: Partial<typeof prisma>, task: () => Promise<T>) {
  const originalEntries = Object.entries(patch).map(([key, value]) => {
    const original = (prisma as any)[key];
    (prisma as any)[key] = { ...original, ...value };
    return { key, original };
  });

  try {
    return await task();
  } finally {
    for (const { key, original } of originalEntries) {
      (prisma as any)[key] = original;
    }
  }
}

async function testMetricsAggregators() {
  const templateSnapshotGroup: GroupResult<typeof prisma.templateSnapshot.groupBy> = [
    {
      templateId: 'tpl_1',
      _count: { templateId: 5 },
      _max: { createdAt: new Date('2025-09-18T08:00:00Z') },
    },
  ];

  const templateRecords = [
    { id: 'tpl_1', slug: 'hero-banner', name: 'Hero Banner', type: 'page' },
  ];

  const jobGroups: GroupResult<typeof prisma.templatePipelineJob.groupBy> = [
    { status: 'SUCCESS', _count: { _all: 8 } },
    { status: 'FAILED', _count: { _all: 2 } },
  ];

  const failureGroups: GroupResult<typeof prisma.promptGenerationRun.groupBy> = [
    { errorMessage: 'schema-validation-error', _count: { _all: 2 } },
  ];

  const runRecords = [
    {
      id: 'run_1',
      status: 'SUCCESS',
      errorMessage: null,
      createdAt: new Date(),
      startedAt: new Date(Date.now() - 1_000),
      finishedAt: new Date(),
      promptId: 'prompt_1',
      artifactPath: null,
      updatedAt: new Date(),
    },
    {
      id: 'run_2',
      status: 'FAILED',
      errorMessage: 'schema-validation-error',
      createdAt: new Date(),
      startedAt: new Date(Date.now() - 1_500),
      finishedAt: new Date(Date.now() - 500),
      promptId: 'prompt_1',
      artifactPath: null,
      updatedAt: new Date(),
    },
  ];

  const statusGroups: GroupResult<typeof prisma.promptGenerationRun.groupBy> = [
    { status: 'SUCCESS', _count: { _all: 1 } },
    { status: 'FAILED', _count: { _all: 1 } },
  ];

  await withPatchedPrisma(
    {
      templateSnapshot: {
        groupBy: async () => templateSnapshotGroup,
      },
      template: {
        findMany: async () => templateRecords,
      },
      templatePipelineJob: {
        groupBy: async () => jobGroups,
      },
      promptGenerationRun: {
        groupBy: async (args: any) => {
          if (args?.by?.[0] === 'errorMessage') return failureGroups as any;
          return statusGroups as any;
        },
        findMany: async () => runRecords,
      },
    },
    async () => {
      const templateMetrics = await getTemplateMetrics({ rangeDays: 7 });
      assert.equal(templateMetrics.templateUsage.length, 1, 'Template usage should include mocked template');
      assert.equal(templateMetrics.jobSummary.SUCCESS, 8, 'SUCCESS count should match mocked data');
      assert.equal(templateMetrics.failureReasons[0]?.reason, 'schema-validation-error');

      const aiMetrics = await getAiMetrics({ rangeDays: 7 });
      assert.equal(aiMetrics.statusBreakdown.SUCCESS, 1, 'Status breakdown should include SUCCESS sample');
      assert.equal(aiMetrics.recentRuns.length, 2, 'Recent runs should expose mocked runs');
      assert.ok((aiMetrics.latency.averageMs ?? 0) > 0, 'Average latency should be computed');
    },
  );

  console.log('✅ metrics aggregation smoke test passed');
}

void testMetricsAggregators().catch((error) => {
  console.error('❌ metrics aggregation test failed');
  console.error(error);
  process.exit(1);
});

