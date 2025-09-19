import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import type { TemplatePlan } from '@/shared/types';
import { logger } from '../../utils/logger';

type TemplateRecord = {
  id: string;
  slug: string;
  type: string;
  version?: string | null;
  engine?: string | null;
  schemaJson?: Record<string, any> | null;
  tokensJson?: Record<string, any> | null;
};

export interface TemplateComposerOptions {
  requestId?: string;
  userId?: string;
  fallback?: TemplatePlan;
}

export interface TemplateComposerResult {
  success: boolean;
  plan: TemplatePlan;
  html: string;
  pages: Array<{ slug: string; html: string }>;
  components: Array<{ slug: string; html: string }>;
  theme?: { slug: string; css?: string | null } | null;
  metadata: {
    requestId?: string;
    fallbackUsed: boolean;
    issues: string[];
    usedTemplates: Array<{ slug: string; type: string; version?: string | null }>;
    durationMs: number;
  };
  snapshot: {
    plan: TemplatePlan;
    html: string;
    pages: Array<{ slug: string; html: string }>;
    fallback: boolean;
    components: Array<{ slug: string; html: string }>;
    generatedAt: string;
  };
}

interface TemplateCacheEntry {
  record: TemplateRecord;
  loadedAt: number;
}

const CACHE_TTL_MS = 60 * 1000;
const templateCache = new Map<string, TemplateCacheEntry>();

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false, useDefaults: false });
addFormats(ajv);
const validatorCache = new Map<string, ValidateFunction>();

let prismaClient: any = null;
let loadPrismaClient = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { prisma } = require('../../database');
  return prisma;
};

let templateLoaderOverride: ((slug: string) => Promise<TemplateRecord | null>) | null = null;
type ComposePageFn = (body: any, opts?: any) => Promise<{ html: string }>;
type RenderTemplateFn = (params: any, opts?: any) => Promise<{ html: string }>;

let composePageOverride: ComposePageFn | null = null;
let renderTemplateOverride: RenderTemplateFn | null = null;
let composePageImpl: ComposePageFn | null = null;
let renderTemplateImpl: RenderTemplateFn | null = null;

export async function composeTemplate(plan: TemplatePlan | null | undefined, options: TemplateComposerOptions = {}): Promise<TemplateComposerResult> {
  const startedAt = Date.now();
  const issues: string[] = [];
  const requestId = options.requestId;

  let effectivePlan = clonePlan(plan);
  let fallbackUsed = false;

  if (!effectivePlan || !effectivePlan.page?.slug) {
    issues.push('plan_missing_page');
    effectivePlan = clonePlan(options.fallback || buildFallbackPlan());
    fallbackUsed = true;
  }

  const fetchResult = await resolveTemplatesForPlan(effectivePlan);
  if (!fetchResult.success) {
    issues.push(...fetchResult.issues);
    effectivePlan = clonePlan(options.fallback || buildFallbackPlan());
    fallbackUsed = true;
  } else {
    issues.push(...fetchResult.issues);
  }

  if (fallbackUsed) {
    const fallbackFetch = await resolveTemplatesForPlan(effectivePlan);
    if (!fallbackFetch.success) {
      const error = new Error('Unable to resolve templates for fallback plan');
      logger.error('templateComposer.fallback_failed', { requestId, issues: fallbackFetch.issues });
      throw error;
    }
    issues.push(...fallbackFetch.issues);
  }

  const normalisedPlan = await normalisePlanData(effectivePlan);

  try {
    const pageResult = await getComposePage()({
      page: normalisedPlan.page,
      components: normalisedPlan.components,
      theme: normalisedPlan.theme?.slug,
    }, { requestId });

    const allPages: Array<{ slug: string; html: string }> = [
      { slug: normalisedPlan.page.slug, html: pageResult.html },
    ];

    if (Array.isArray(normalisedPlan.pages)) {
      for (const altPage of normalisedPlan.pages) {
        if (!altPage?.slug || altPage.slug === normalisedPlan.page.slug) continue;
        try {
          const altResult = await getComposePage()({
            page: altPage,
            components: normalisedPlan.components,
            theme: normalisedPlan.theme?.slug,
          }, { requestId });
          allPages.push({ slug: altPage.slug, html: altResult.html });
        } catch (altError) {
          issues.push(`compose_fail:${altPage.slug}`);
          logger.warn('templateComposer.additionalPageFailed', {
            slug: altPage.slug,
            error: altError instanceof Error ? altError.message : String(altError),
          });
        }
      }
    }

    const componentHtml: Array<{ slug: string; html: string }> = [];
    for (const component of normalisedPlan.components) {
      const rendered = await getRenderTemplate()({ slug: component.slug, data: component.data, theme: normalisedPlan.theme?.slug });
      componentHtml.push({ slug: component.slug, html: rendered.html });
    }

    const durationMs = Date.now() - startedAt;
    const metadata = {
      requestId,
      fallbackUsed,
      issues,
      usedTemplates: buildTemplateUsage(normalisedPlan),
      durationMs,
    };

    logger.info('templateComposer.success', metadata);

    return {
      success: true,
      plan: normalisedPlan,
      html: pageResult.html,
      pages: allPages,
      components: componentHtml,
      theme: normalisedPlan.theme ? { slug: normalisedPlan.theme.slug, css: null } : null,
      metadata,
      snapshot: {
        plan: normalisedPlan,
        html: pageResult.html,
        pages: allPages,
        fallback: fallbackUsed,
        components: componentHtml,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    issues.push(error?.message || 'compose_failed');
    logger.error('templateComposer.failed', { requestId, fallbackUsed, error: error?.message, issues });
    if (!fallbackUsed) {
      const fallbackPlan = clonePlan(options.fallback || buildFallbackPlan());
      const fallbackFetch = await resolveTemplatesForPlan(fallbackPlan);
      if (!fallbackFetch.success) {
        throw error;
      }
      const fallbackResult = await composeTemplate(fallbackPlan, { ...options, requestId, fallback: options.fallback });
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata,
          fallbackUsed: true,
          issues: [...fallbackResult.metadata.issues, 'fallback_after_failure'],
        },
      };
    }
    throw error;
  }
}

async function normalisePlanData(plan: TemplatePlan): Promise<TemplatePlan> {
  const normalised: TemplatePlan = clonePlan(plan);
  const pageTemplate = await loadTemplate(normalised.page.slug);
  if (pageTemplate?.schemaJson) {
    const { data, changed } = applySchemaDefaults(pageTemplate.schemaJson, normalised.page.data);
    normalised.page.data = data;
    if (changed && typeof logger.debug === 'function') {
      logger.debug('templateComposer.pageDefaultsApplied', { slug: pageTemplate.slug });
    }
  }

  if (Array.isArray(normalised.pages)) {
    const extraPages: TemplatePlan['pages'] = [];
    for (const extra of normalised.pages) {
      if (!extra?.slug || extra.slug === normalised.page.slug) continue;
      const extraTemplate = await loadTemplate(extra.slug);
      if (extraTemplate?.schemaJson) {
        const { data } = applySchemaDefaults(extraTemplate.schemaJson, extra.data);
        extraPages.push({ slug: extra.slug, data });
      } else {
        extraPages.push(extra);
      }
    }
    normalised.pages = extraPages;
  }

  const updatedComponents = [] as TemplatePlan['components'];
  for (const component of normalised.components || []) {
    const template = await loadTemplate(component.slug);
    if (template?.schemaJson) {
      const { data } = applySchemaDefaults(template.schemaJson, component.data);
      updatedComponents.push({ ...component, data });
    } else {
      updatedComponents.push(component);
    }
  }
  normalised.components = updatedComponents;

  if (normalised.theme?.slug) {
    const themeTemplate = await loadTemplate(normalised.theme.slug);
    if (themeTemplate?.schemaJson) {
      const { data } = applySchemaDefaults(themeTemplate.schemaJson, normalised.theme.data);
      normalised.theme = { ...normalised.theme, data };
    }
  }

  return normalised;
}

function applySchemaDefaults(schema: Record<string, any>, input: Record<string, any> | undefined) {
  const result = { ...(input || {}) };
  let changed = false;
  const properties = schema?.properties || {};
  const required: string[] = Array.isArray(schema?.required) ? schema.required : [];

  for (const [key, definition] of Object.entries(properties)) {
    if (result[key] === undefined) {
      result[key] = deriveDefaultValue(definition);
      changed = true;
    }
  }

  for (const field of required) {
    if (result[field] === undefined || result[field] === null) {
      const definition = properties[field] || {};
      result[field] = deriveDefaultValue(definition);
      changed = true;
    }
  }

  const validator = obtainValidator(schema);
  if (!validator(result)) {
    return { data: result, changed, valid: false, errors: validator.errors };
  }

  return { data: result, changed, valid: true };
}

function deriveDefaultValue(definition: any) {
  if (definition && typeof definition === 'object') {
    if ('default' in definition) return definition.default;
    const type = Array.isArray(definition.type) ? definition.type[0] : definition.type;
    switch (type) {
      case 'boolean': return false;
      case 'number':
      case 'integer': return 0;
      case 'array': return [];
      case 'object': return {};
      case 'string':
      default: return '';
    }
  }
  return null;
}

function obtainValidator(schema: Record<string, any>) {
  const key = JSON.stringify(schema);
  let validator = validatorCache.get(key);
  if (!validator) {
    validator = ajv.compile(schema);
    validatorCache.set(key, validator);
  }
  return validator;
}

async function resolveTemplatesForPlan(plan: TemplatePlan): Promise<{ success: boolean; issues: string[] }> {
  const issues: string[] = [];
  const page = await loadTemplate(plan.page.slug);
  if (!page) {
    issues.push(`missing_page:${plan.page.slug}`);
    return { success: false, issues };
  }

  if (Array.isArray(plan.pages)) {
    for (const extra of plan.pages) {
      if (!extra?.slug || extra.slug === plan.page.slug) continue;
      const template = await loadTemplate(extra.slug);
      if (!template) {
        issues.push(`missing_page:${extra.slug}`);
        return { success: false, issues };
      }
    }
  }

  for (const component of plan.components || []) {
    const template = await loadTemplate(component.slug);
    if (!template) {
      issues.push(`missing_component:${component.slug}`);
      return { success: false, issues };
    }
  }

  if (plan.theme?.slug) {
    const theme = await loadTemplate(plan.theme.slug);
    if (!theme) {
      issues.push(`missing_theme:${plan.theme.slug}`);
      return { success: false, issues };
    }
  }

  return { success: true, issues };
}

async function loadTemplate(slug: string): Promise<TemplateRecord | null> {
  if (templateLoaderOverride) return templateLoaderOverride(slug);

  const cached = templateCache.get(slug);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.record;
  }

  try {
    const prisma = getPrisma();
    const record = await prisma.template.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        type: true,
        version: true,
        engine: true,
        schemaJson: true,
        tokensJson: true,
      },
    });
    if (record) {
      templateCache.set(slug, { record, loadedAt: Date.now() });
      return record;
    }
  } catch (error) {
    logger.warn('templateComposer.templateLookup.prismaFailed', { slug, error: (error as Error)?.message });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { getMemoryTemplateBySlug } = require('../templateMemory');
    const memory = getMemoryTemplateBySlug(slug);
    if (memory) {
      const record: TemplateRecord = {
        id: memory.id,
        slug: memory.slug,
        type: memory.type,
        version: memory.version,
        engine: memory.engine,
        schemaJson: memory.schemaJson,
        tokensJson: memory.tokensJson,
      };
      templateCache.set(slug, { record, loadedAt: Date.now() });
      return record;
    }
  } catch (error) {
    logger.warn('templateComposer.templateLookup.memoryFailed', { slug, error: (error as Error)?.message });
  }

  return null;
}

function getPrisma() {
  if (!prismaClient) {
    prismaClient = loadPrismaClient();
  }
  return prismaClient;
}

function clonePlan(plan: TemplatePlan | null | undefined): TemplatePlan {
  if (!plan) {
    return {
      page: { slug: '', data: {} },
      components: [],
      theme: null,
      metadata: {},
    };
  }
  return JSON.parse(JSON.stringify(plan));
}

function buildFallbackPlan(): TemplatePlan {
  return {
    page: {
      slug: 'landing-page-basic',
      data: {
        headline: 'Launch your project with confidence',
        subheading: 'Assemble responsive sites with curated templates.',
        cta: 'Get Started',
      },
    },
    components: [
      {
        slot: 'hero',
        slug: 'hero-banner',
        data: {
          title: 'Build a compelling hero section',
          subtitle: 'Quickly assemble layouts from the template library.',
          cta: { text: 'Try Now', href: '/signup' },
        },
      },
      {
        slot: 'features',
        slug: 'three-column-features',
        data: {
          items: [
            { title: 'Rich library', description: 'Pages, components, and themes ready to mix.' },
            { title: 'AI orchestration', description: 'Automatic selection of the best fitting templates.' },
            { title: 'Safe rollback', description: 'Keep generation snapshots for quick restore.' },
          ],
        },
      },
    ],
    theme: {
      slug: 'modern-light',
      data: {
        palette: 'light',
        accent: '#4f46e5',
      },
    },
    metadata: {
      fallback: true,
    },
  };
}

function buildTemplateUsage(plan: TemplatePlan) {
  const usage: Array<{ slug: string; type: string; version?: string | null }> = [];
  usage.push({ slug: plan.page.slug, type: 'page', version: undefined });
  if (Array.isArray(plan.pages)) {
    for (const page of plan.pages) {
      usage.push({ slug: page.slug, type: 'page', version: undefined });
    }
  }
  for (const component of plan.components || []) {
    usage.push({ slug: component.slug, type: 'component', version: undefined });
  }
  if (plan.theme?.slug) {
    usage.push({ slug: plan.theme.slug, type: 'theme', version: undefined });
  }
  return usage;
}

function getComposePage(): ComposePageFn {
  if (composePageOverride) return composePageOverride;
  if (!composePageImpl) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('../templateRenderer');
    composePageImpl = mod.composePage as ComposePageFn;
  }
  return composePageImpl;
}

function getRenderTemplate(): RenderTemplateFn {
  if (renderTemplateOverride) return renderTemplateOverride;
  if (!renderTemplateImpl) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('../templateRenderer');
    renderTemplateImpl = mod.renderTemplate as RenderTemplateFn;
  }
  return renderTemplateImpl;
}

export const __testing = {
  setTemplateLoader(loader: ((slug: string) => Promise<TemplateRecord | null>) | null) {
    templateLoaderOverride = loader;
  },
  setComposePage(fn: ComposePageFn | null) {
    composePageOverride = fn;
  },
  setRenderTemplate(fn: RenderTemplateFn | null) {
    renderTemplateOverride = fn;
  },
  setPrisma(client: any) {
    prismaClient = client;
    loadPrismaClient = () => client;
  },
  reset() {
    templateLoaderOverride = null;
    composePageOverride = null;
    renderTemplateOverride = null;
    prismaClient = null;
    loadPrismaClient = () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { prisma } = require('../../database');
      return prisma;
    };
    templateCache.clear();
    composePageImpl = null;
    renderTemplateImpl = null;
  },
};
