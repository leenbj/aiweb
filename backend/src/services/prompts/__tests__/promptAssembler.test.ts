import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assemblePromptReviewItem, type PromptReviewTemplateSummary } from '../promptAssemblerCore';
import type { PromptWithRelations } from '../promptRepository';

const basePrompt: PromptWithRelations = {
  id: 'prompt-1',
  name: 'Hero Section',
  rawText: '...',
  tags: ['hero'],
  status: 'PENDING',
  source: 'OPERATION',
  targetSlug: null,
  latestJobId: 'job-1',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  generationRuns: [
    {
      id: 'run-1',
      promptId: 'prompt-1',
      status: 'SUCCESS',
      errorMessage: null,
      artifactPath: '/artifacts/run-1.zip',
      startedAt: new Date('2024-01-02T00:10:00.000Z'),
      finishedAt: new Date('2024-01-02T00:12:00.000Z'),
    },
  ],
  pipelineJobs: [
    {
      id: 'job-1',
      promptId: 'prompt-1',
      importType: 'PROMPT',
      status: 'SUCCESS',
      retryCount: 0,
      templateIds: ['tpl-1', 'missing-template'],
      versionIds: ['ver-1'],
      metadata: {
        packagePatchPath: '/patches/job-1.patch',
        previewPath: '/preview/job-1',
      },
      createdAt: new Date('2024-01-02T00:05:00.000Z'),
      updatedAt: new Date('2024-01-02T00:06:00.000Z'),
    },
  ],
};

const templateSummary: PromptReviewTemplateSummary = {
  id: 'tpl-1',
  slug: 'hero-banner',
  name: 'Hero Banner',
  type: 'component',
  version: '1.0.0',
  tags: ['hero'],
  updatedAt: '2024-01-02T00:00:00.000Z',
  previewUrl: '/api/templates/hero-banner',
};

test('assemblePromptReviewItem builds aggregate review item', () => {
  const result = assemblePromptReviewItem(basePrompt, new Map([[templateSummary.id, templateSummary]]));

  assert.equal(result.prompt.id, 'prompt-1');
  assert.equal(result.latestRun?.id, 'run-1');
  assert.equal(result.latestJob?.id, 'job-1');
  assert.equal(result.statistics.totalRuns, 1);
  assert.equal(result.statistics.totalJobs, 1);

  assert.equal(result.templateSummaries.length, 1);
  assert.equal(result.templateSummaries[0].slug, 'hero-banner');
  assert.ok(result.templateSlugs.includes('hero-banner'));
  assert.ok(result.previewUrls.includes('/api/templates/hero-banner'));
  assert.ok(result.previewUrls.includes('/preview/job-1'));
  assert.ok(result.patchDownloadUrls.includes('/patches/job-1.patch'));

  const jobTemplates = result.jobs[0].templates;
  assert.equal(jobTemplates.length, 2);
  const missing = jobTemplates.find((tpl) => tpl.id === 'missing-template');
  assert.ok(missing?.missing);
});
