import { logger } from '../../utils/logger';
import type { TemplateSummary, TemplatePlan } from '@/shared/types';
import { getTemplateSummaries } from '../templateIndex';

export interface ComposeSystemPromptOptions {
  type?: string;
  tag?: string;
  keyword?: string;
  engine?: string;
  scenario?: string;
  maxTemplates?: number;
  pageSize?: number;
}

export interface SystemPromptChunk {
  prompt: string;
  templates: TemplateSummary[];
}

export interface SystemPromptResult {
  prompts: SystemPromptChunk[];
  slugs: string[];
  metadata: {
    filters: Pick<ComposeSystemPromptOptions, 'type' | 'tag' | 'keyword' | 'engine' | 'scenario'>;
    totalTemplates: number;
    chunkSize: number;
    chunks: number;
    truncated: boolean;
    cachedAt: string | null;
    strategy: string | null;
    strategiesUsed: string[];
    strategiesTried: string[];
    pagesLoaded: number;
  };
}

interface StrategyDefinition {
  name: string;
  filters?: Pick<ComposeSystemPromptOptions, 'type' | 'tag' | 'keyword' | 'engine'>;
  pageSize?: number;
  maxPages?: number;
}

interface StrategyAttemptRecord {
  strategy: string;
  page: number;
  count: number;
  total: number;
  pageSize: number;
  hasNextPage: boolean;
}

interface StrategyResolutionResult {
  templates: TemplateSummary[];
  selectedStrategy: string | null;
  attempts: StrategyAttemptRecord[];
  strategiesUsed: string[];
  truncated: boolean;
  pagesLoaded: number;
  cachedAt: string | null;
}

export interface PromptStrategyConfig {
  maxTemplatesPerChunk: number;
  maxTotalTemplates: number;
  defaultMaxPages: number;
  introTemplate: (context: { scenario?: string }) => string;
  templateLine: (summary: TemplateSummary) => string;
  outroTemplate: (allowedSlugs: string[]) => string;
  examples: TemplatePlan[];
  defaultStrategies: StrategyDefinition[];
  scenarioStrategyFactory: (scenario?: string | null) => StrategyDefinition[];
}

const DEFAULT_CONFIG: PromptStrategyConfig = {
  maxTemplatesPerChunk: 10,
  maxTotalTemplates: 60,
  defaultMaxPages: 3,
  introTemplate: ({ scenario }) => {
    const base =
      'You are the TemplatePlan Strategist for the AI Website Builder. '
      + 'Your job is to choose from the provided template library and produce a TemplatePlan JSON.';
    if (scenario && scenario.trim()) {
      return `${base}\nScenario: ${scenario.trim()}`;
    }
    return base;
  },
  templateLine: (summary) => {
    const keyFields = summary.keyFields?.length ? `keyFields: ${summary.keyFields.join(', ')}` : 'keyFields: -';
    const tags = summary.tags?.length ? summary.tags.join(', ') : 'None';
    return `- ${summary.slug} [${summary.type} | ${summary.engine}] | tags: ${tags} | ${keyFields}\n  summary: ${summary.summary}`;
  },
  outroTemplate: (allowedSlugs) => {
    return (
      'Return a single JSON object matching TemplatePlan schema:\n'
      + '{\n'
      + '  "page": { "slug": string, "data": object },\n'
      + '  "components": [ { "slot": string, "slug": string, "data": object } ],\n'
      + '  "theme": { "slug": string, "data": object } | null,\n'
      + '  "metadata": object?\n'
      + '}\n'
      + 'Only use slugs from this list: '
      + allowedSlugs.join(', ')
      + '\nDo not include explanations or extra text; respond with JSON only.'
    );
  },
  examples: [
    {
      page: {
        slug: 'landing-page-basic',
        data: {
          headline: 'Launch your product faster',
          subheading: 'Beautiful landing pages assembled from reusable blocks.',
          cta: 'Get Started',
        },
      },
      components: [
        {
          slot: 'hero',
          slug: 'hero-banner',
          data: {
            title: 'Craft a compelling headline',
            subtitle: 'Highlight the core value proposition',
            cta: {
              text: 'Start Building',
              href: '/signup',
            },
          },
        },
        {
          slot: 'features',
          slug: 'three-column-features',
          data: {
            items: [
              { title: 'Reusable Blocks', description: 'Combine hero, pricing, testimonial blocks' },
              { title: 'Responsive Design', description: 'Optimized for mobile and desktop' },
              { title: 'AI Generated Copy', description: 'Draft persuasive text automatically' },
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
        rationale: 'Customer requested a SaaS landing page with hero + features',
      },
    },
  ],
  defaultStrategies: [
    { name: 'balanced-default', filters: {}, maxPages: 3 },
  ],
  scenarioStrategyFactory: (scenario) => {
    if (!scenario || !scenario.trim()) return [];
    const normalized = scenario.trim();
    return [
      { name: 'scenario-keyword', filters: { keyword: normalized }, maxPages: 2 },
      { name: 'scenario-tag', filters: { tag: normalized }, maxPages: 2 },
      { name: 'scenario-type-page', filters: { type: 'page' }, maxPages: 2 },
    ];
  },
};

let config: PromptStrategyConfig = { ...DEFAULT_CONFIG };

export function configurePromptStrategy(partial: Partial<PromptStrategyConfig>) {
  config = {
    ...config,
    ...partial,
  };
}

export function resetPromptStrategyConfig() {
  config = { ...DEFAULT_CONFIG };
}

export async function composeSystemPrompt(options: ComposeSystemPromptOptions = {}): Promise<SystemPromptResult> {
  const { maxTemplates, scenario, ...filters } = options;
  const chunkSize = Math.max(1, Math.min(config.maxTemplatesPerChunk, maxTemplates ?? config.maxTemplatesPerChunk));
  const limit = Math.max(chunkSize, Math.min(maxTemplates ?? config.maxTotalTemplates, config.maxTotalTemplates));

  const strategyResolution = await resolveTemplates({
    baseFilters: filters,
    scenario,
    pageSize: options.pageSize,
    totalLimit: limit,
    chunkSize,
  });

  const templates = strategyResolution.templates;
  const prompts: SystemPromptChunk[] = [];
  const slugs: string[] = [];

  const intro = config.introTemplate({ scenario });
  const exampleSection = renderExamples();

  for (let i = 0; i < templates.length; i += chunkSize) {
    const chunk = templates.slice(i, i + chunkSize);
    const chunkSlugs = chunk.map((template) => template.slug);
    const body = chunk.map((template) => config.templateLine(template)).join('\n');
    slugs.push(...chunkSlugs);

    const sections = [intro, `Chunk ${Math.floor(i / chunkSize) + 1}:`, body];
    if (exampleSection && i === 0) {
      sections.push(exampleSection);
    }
    sections.push(config.outroTemplate(chunkSlugs));
    const prompt = sections.join('\n\n');
    prompts.push({ prompt, templates: chunk });
  }

  if (!prompts.length) {
    const placeholder = `${intro}\n\nNo templates found for current filters. Ask the user for more details or fallback to default TemplatePlan.`;
    prompts.push({ prompt: placeholder, templates: [] });
  }

  logger.info('promptStrategy.compose', {
    filters: { ...filters, scenario },
    total: strategyResolution.templates.length,
    chunkSize,
    chunks: prompts.length,
    truncated: strategyResolution.truncated,
    strategy: strategyResolution.selectedStrategy,
    strategiesUsed: strategyResolution.strategiesUsed,
    strategiesTried: strategyResolution.attempts.map((attempt) => attempt.strategy),
    pagesLoaded: strategyResolution.pagesLoaded,
  });

  return {
    prompts,
    slugs,
    metadata: {
      filters: { ...filters, scenario },
      totalTemplates: strategyResolution.templates.length,
      chunkSize,
      chunks: prompts.length,
      truncated: strategyResolution.truncated,
      cachedAt: strategyResolution.cachedAt,
      strategy: strategyResolution.selectedStrategy,
      strategiesUsed: strategyResolution.strategiesUsed,
      strategiesTried: strategyResolution.attempts.map((attempt) => attempt.strategy),
      pagesLoaded: strategyResolution.pagesLoaded,
    },
  };
}

export function getTemplatePlanExamples(): TemplatePlan[] {
  return config.examples;
}

function renderExamples() {
  if (!config.examples.length) return '';
  const formatted = config.examples
    .map((example, index) => `Example ${index + 1}:\n${JSON.stringify(example, null, 2)}`)
    .join('\n\n');
  return `TemplatePlan Examples:\n${formatted}`;
}

async function resolveTemplates(params: {
  baseFilters: Pick<ComposeSystemPromptOptions, 'type' | 'tag' | 'keyword' | 'engine'>;
  scenario?: string;
  pageSize?: number;
  totalLimit: number;
  chunkSize: number;
}): Promise<StrategyResolutionResult> {
  const { baseFilters, scenario, pageSize, totalLimit } = params;
  const attempts: StrategyAttemptRecord[] = [];
  const templates: TemplateSummary[] = [];
  const seenSlugs = new Set<string>();
  const usedStrategies: string[] = [];
  let selectedStrategy: string | null = null;
  let pagesLoaded = 0;
  let cachedAt: string | null = null;
  let truncated = false;

  const strategySequence = buildStrategySequence(scenario);

  for (const strategy of strategySequence) {
    const effectiveFilters: Pick<ComposeSystemPromptOptions, 'type' | 'tag' | 'keyword' | 'engine'> = {
      ...baseFilters,
    };

    if (strategy.filters) {
      for (const [key, value] of Object.entries(strategy.filters) as Array<[
        keyof StrategyDefinition['filters'],
        string | undefined,
      ]>) {
        if (value === undefined || value === null || value === '') continue;
        if (effectiveFilters[key] === undefined || effectiveFilters[key] === '') {
          effectiveFilters[key] = value;
        }
      }
    }

    const effectivePageSize = strategy.pageSize ?? pageSize ?? params.chunkSize * 3;
    const maxPages = strategy.maxPages ?? config.defaultMaxPages;

    let page = 1;
    let strategyHasData = false;
    let lastHasNextPage = false;

    while (page <= maxPages && templates.length < totalLimit) {
      const summaries = await getTemplateSummaries({
        type: effectiveFilters.type,
        tag: effectiveFilters.tag,
        keyword: effectiveFilters.keyword,
        engine: effectiveFilters.engine,
        page,
        pageSize: effectivePageSize,
      });

      pagesLoaded += 1;
      lastHasNextPage = summaries.hasNextPage;
      attempts.push({
        strategy: strategy.name,
        page,
        count: summaries.items.length,
        total: summaries.total,
        pageSize: effectivePageSize,
        hasNextPage: summaries.hasNextPage,
      });

      if (summaries.cachedAt) {
        cachedAt = summaries.cachedAt;
      }

      for (const template of summaries.items) {
        if (templates.length >= totalLimit) {
          truncated = true;
          break;
        }
        if (seenSlugs.has(template.slug)) continue;
        templates.push(template);
        seenSlugs.add(template.slug);
        strategyHasData = true;
      }

      if (!summaries.hasNextPage || templates.length >= totalLimit) {
        truncated = summaries.hasNextPage && templates.length >= totalLimit;
        break;
      }

      page += 1;
    }

    if (page > maxPages && lastHasNextPage) {
      truncated = true;
    }

    if (strategyHasData) {
      usedStrategies.push(strategy.name);
      if (!selectedStrategy) {
        selectedStrategy = strategy.name;
      }
    }

    if (templates.length >= totalLimit) {
      break;
    }
  }

  if (templates.length === 0 && strategySequence.length > 0) {
    truncated = false;
  }

  return {
    templates,
    selectedStrategy,
    attempts,
    strategiesUsed: usedStrategies,
    truncated,
    pagesLoaded,
    cachedAt,
  };
}

function buildStrategySequence(scenario?: string | null): StrategyDefinition[] {
  const scenarioStrategies = config.scenarioStrategyFactory(scenario);
  const names = new Set<string>();
  const sequence: StrategyDefinition[] = [];

  for (const strategy of scenarioStrategies) {
    if (names.has(strategy.name)) continue;
    names.add(strategy.name);
    sequence.push(strategy);
  }

  for (const strategy of config.defaultStrategies) {
    if (names.has(strategy.name)) continue;
    names.add(strategy.name);
    sequence.push(strategy);
  }

  return sequence;
}
