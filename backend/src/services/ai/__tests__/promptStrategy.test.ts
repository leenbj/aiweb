import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { composeSystemPrompt, configurePromptStrategy, resetPromptStrategyConfig, getTemplatePlanExamples } from '../promptStrategy';
import { __testing as templateIndexTesting } from '../../templateIndex';

const templates = Array.from({ length: 15 }).map((_, index) => ({
  id: `tpl-${index}`,
  slug: `template-${index}`,
  name: `Template ${index}`,
  type: index % 2 === 0 ? 'component' : 'page',
  engine: 'react',
  version: '1.0.0',
  tags: index % 2 === 0 ? ['hero'] : ['landing'],
  summary: `Summary ${index}`,
  keyFields: ['headline', 'cta'],
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
}));

beforeEach(() => {
  templateIndexTesting.resetCache();
  templateIndexTesting.setCacheTtl(60 * 1000);
  templateIndexTesting.setPrismaClient({
    template: {
      findMany: async () => templates,
      count: async () => templates.length,
    },
  });
  configurePromptStrategy({ maxTemplatesPerChunk: 5 });
});

afterEach(() => {
  templateIndexTesting.resetCache();
  templateIndexTesting.resetPrismaClient();
  resetPromptStrategyConfig();
});

test('composeSystemPrompt returns prompts with allowed slugs and instructions', async () => {
  const result = await composeSystemPrompt({ type: 'component', maxTemplates: 5, scenario: 'landing-page' });
  assert.ok(result.prompts.length >= 1);
  const firstPrompt = result.prompts[0].prompt;
  assert.match(firstPrompt, /TemplatePlan/);
  assert.match(firstPrompt, /landing-page/);
  assert.ok(result.slugs.every((slug) => slug.startsWith('template-')));
  assert.ok(firstPrompt.includes('Only use slugs'));
  assert.equal(result.metadata.strategy, 'scenario-type-page');
  assert.deepEqual(result.metadata.strategiesUsed, ['scenario-type-page']);
  assert.ok(result.metadata.strategiesTried.includes('scenario-keyword'));
  assert.ok(result.metadata.pagesLoaded >= 1);
});

test('composeSystemPrompt chunks templates when exceeding max', async () => {
  configurePromptStrategy({ maxTemplatesPerChunk: 3 });
  const result = await composeSystemPrompt({ maxTemplates: 7 });
  assert.ok(result.prompts.length > 1);
  assert.equal(result.metadata.truncated, true);
  assert.equal(result.metadata.chunkSize, 3);
  assert.ok(result.metadata.totalTemplates <= 7);
  assert.deepEqual([...new Set(result.slugs)].length, result.slugs.length);
});

test('getTemplatePlanExamples returns default examples', () => {
  const examples = getTemplatePlanExamples();
  assert.ok(examples.length >= 1);
  assert.ok(examples[0].page.slug.length > 0);
});

test('composeSystemPrompt falls back to default strategy when scenario filters miss', async () => {
  templateIndexTesting.resetCache();
  templateIndexTesting.setPrismaClient({
    template: {
      findMany: async () => [
        {
          id: 'tpl-landing',
          slug: 'landing-main',
          name: 'Landing Main',
          type: 'component',
          engine: 'react',
          version: '1.0.0',
          tags: ['landing'],
          summary: 'Primary landing template',
          description: 'Primary landing template',
          schemaJson: {},
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
      count: async () => 1,
    },
  });

  const result = await composeSystemPrompt({ scenario: 'unknown-scenario' });
  assert.equal(result.metadata.strategy, 'balanced-default');
  assert.ok(result.prompts[0].prompt.includes('landing'));
  assert.ok(result.metadata.strategiesTried.includes('balanced-default'));
  assert.ok(result.metadata.strategiesTried.includes('scenario-keyword'));
});
