import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { planTemplate, __testing as templatePlannerTesting } from '../templatePlanner';
import { __testing as templateIndexTesting } from '../../templateIndex';

type ChatMock = (messages: any[], userId?: string, customPrompt?: string, model?: string) => Promise<string>;

let chatMock: ChatMock;

beforeEach(() => {
  templateIndexTesting.resetCache();
  templateIndexTesting.setCacheTtl(60 * 1000);
  templateIndexTesting.setPrismaClient({
    template: {
      findMany: async () => [
        {
          id: 'tpl-hero',
          slug: 'hero-banner',
          name: 'Hero Banner',
          type: 'component',
          engine: 'react',
          version: '1.0.0',
          tags: ['hero'],
          description: 'Hero section',
          schemaJson: {
            properties: {
              headline: {},
              cta: {},
            },
          },
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
      count: async () => 1,
    },
  });
  chatMock = async () => JSON.stringify({
    page: { slug: 'hero-banner', data: { headline: 'Hello' } },
    components: [
      { slot: 'hero', slug: 'hero-banner', data: { headline: 'Hello' } },
    ],
    theme: null,
    metadata: null,
  });
  templatePlannerTesting.setAiService({
    chat: async (messages, userId, customPrompt, model) => chatMock(messages, userId, customPrompt, model),
  });
});

afterEach(() => {
  templateIndexTesting.resetCache();
  templateIndexTesting.resetPrismaClient();
  templatePlannerTesting.resetAiService();
});

test('planTemplate returns valid TemplatePlan', async () => {
  chatMock = async () => JSON.stringify({
    page: { slug: 'hero-banner', data: { headline: 'Hello' } },
    components: [
      { slot: 'hero', slug: 'hero-banner', data: { headline: 'Hello' } },
    ],
    theme: null,
    metadata: null,
  });

  const result = await planTemplate({ userContext: 'Generate a hero section', filters: { type: 'component' } });
  assert.equal(result.success, true);
  assert.ok(result.plan);
  assert.equal(result.plan?.page.slug, 'hero-banner');
  assert.equal(result.attempts, 1);
});

test('planTemplate retries on invalid response and succeeds', async () => {
  const responses = [
    'not json',
    JSON.stringify({
      page: { slug: 'hero-banner' },
      components: [
        { slot: 'hero', slug: 'hero-banner' },
      ],
      theme: null,
    }),
  ];
  let callIndex = 0;
  chatMock = async () => responses[callIndex++];

  const result = await planTemplate({ userContext: 'Generate a hero section', filters: { type: 'component' } });
  assert.equal(result.success, true);
  assert.equal(result.attempts, 2);
});

test('planTemplate returns failure after retries exhausted', async () => {
  chatMock = async () => 'invalid json';

  const result = await planTemplate({ userContext: 'Generate a hero section', filters: { type: 'component' }, maxRetries: 1 });
  assert.equal(result.success, false);
  assert.equal(result.plan, null);
  assert.equal(result.attempts, 2);
  assert.ok(result.error);
});
