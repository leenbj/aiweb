import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import type { TemplatePlan } from '@/shared/types';
import { composeTemplate, __testing as templateComposerTesting } from '../templateComposer';

type TemplateStub = {
  id: string;
  slug: string;
  type: string;
  version?: string;
  engine?: string;
  schemaJson?: Record<string, any>;
  tokensJson?: Record<string, any>;
};

let templates: Record<string, TemplateStub>;

beforeEach(() => {
  templates = {};
  templateComposerTesting.reset();
  templateComposerTesting.setTemplateLoader(async (slug) => templates[slug] || null);
  templateComposerTesting.setComposePage(async (body) => ({ html: `<html>${body.page.slug}</html>` } as any));
  templateComposerTesting.setRenderTemplate(async ({ slug }) => ({ html: `<div data-slug="${slug}"></div>` } as any));
});

afterEach(() => {
  templateComposerTesting.reset();
});

test('composeTemplate returns html and component renders when plan is valid', async () => {
  registerTemplate({ slug: 'page-landing', type: 'page' });
  registerTemplate({ slug: 'hero-component', type: 'component' });
  registerTemplate({ slug: 'modern-light', type: 'theme' });

  const plan: TemplatePlan = {
    page: { slug: 'page-landing', data: { headline: 'Hi' } },
    components: [{ slot: 'hero', slug: 'hero-component', data: { title: 'Hero' } }],
    theme: { slug: 'modern-light', data: { palette: 'light' } },
    metadata: { source: 'test' },
  };

  const result = await composeTemplate(plan, { requestId: 'req-1' });

  assert.equal(result.success, true);
  assert.equal(result.html.includes('page-landing'), true);
  assert.equal(Array.isArray(result.pages), true);
  assert.equal(result.pages[0].slug, 'page-landing');
  assert.equal(result.metadata.fallbackUsed, false);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].slug, 'hero-component');
  assert.equal(result.metadata.usedTemplates.length, 3);
  assert.equal(result.plan.page.slug, 'page-landing');
});

test('composeTemplate renders additional pages when provided', async () => {
  registerTemplate({ slug: 'page-landing', type: 'page' });
  registerTemplate({ slug: 'page-about', type: 'page' });
  registerTemplate({ slug: 'hero-component', type: 'component' });

  const plan: TemplatePlan = {
    page: { slug: 'page-landing', data: {} },
    pages: [{ slug: 'page-about', data: {} }],
    components: [{ slot: 'hero', slug: 'hero-component', data: {} }],
    metadata: {},
  };

  const result = await composeTemplate(plan);

  assert.equal(result.pages.length >= 2, true);
  const pageSlugs = result.pages.map((p) => p.slug);
  assert.ok(pageSlugs.includes('page-about'));
});

test('composeTemplate falls back when component missing', async () => {
  registerTemplate({ slug: 'landing-page-basic', type: 'page' });
  registerTemplate({ slug: 'hero-banner', type: 'component' });
  registerTemplate({ slug: 'three-column-features', type: 'component' });
  registerTemplate({ slug: 'modern-light', type: 'theme' });

  const plan: TemplatePlan = {
    page: { slug: 'unknown-page', data: {} },
    components: [{ slot: 'hero', slug: 'missing-comp', data: {} }],
    theme: { slug: 'modern-light', data: {} },
    metadata: {},
  };

  const result = await composeTemplate(plan);

  assert.equal(result.metadata.fallbackUsed, true);
  assert.equal(result.plan.page.slug, 'landing-page-basic');
  const componentSlugs = result.plan.components.map((c) => c.slug);
  assert.ok(componentSlugs.includes('hero-banner'));
});

test('composeTemplate applies schema defaults to missing data', async () => {
  registerTemplate({
    slug: 'page-landing',
    type: 'page',
    schemaJson: {
      type: 'object',
      properties: {
        headline: { type: 'string', default: 'Default Headline' },
        subheading: { type: 'string' },
      },
      required: ['headline', 'subheading'],
    },
  });
  registerTemplate({ slug: 'modern-light', type: 'theme' });

  const plan: TemplatePlan = {
    page: { slug: 'page-landing', data: { headline: undefined } as any },
    components: [],
    theme: { slug: 'modern-light', data: {} },
    metadata: {},
  };

  const result = await composeTemplate(plan);

  assert.equal(result.metadata.fallbackUsed, false);
  assert.equal(result.plan.page.data?.headline, 'Default Headline');
  assert.equal(result.plan.page.data?.subheading, '');
});

function registerTemplate(template: Partial<TemplateStub> & { slug: string; type: string }) {
  const id = template.id || `tpl_${template.slug}`;
  templates[template.slug] = {
    id,
    slug: template.slug,
    type: template.type,
    version: template.version || '1.0.0',
    engine: template.engine || 'plain',
    schemaJson: template.schemaJson ?? undefined,
    tokensJson: template.tokensJson ?? undefined,
  };
}
