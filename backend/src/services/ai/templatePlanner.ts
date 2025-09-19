import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import type { TemplatePlan } from '@/shared/types';
import { composeSystemPrompt, type ComposeSystemPromptOptions } from './promptStrategy';
import { logger } from '../../utils/logger';

export interface TemplatePlannerInput {
  userContext: string;
  scenario?: string;
  filters?: ComposeSystemPromptOptions;
  userId?: string;
  customPrompt?: string;
  model?: string;
  maxRetries?: number;
}

export interface TemplatePlannerResult {
  success: boolean;
  plan: TemplatePlan | null;
  attempts: number;
  rawResponses: string[];
  usedSlugs: string[];
  error?: string;
  metadata: {
    chunksTried: number;
    totalTemplates: number;
    chunkSize: number;
    cachedAt: string | null;
    filters: ComposeSystemPromptOptions | undefined;
  };
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const templatePlanSchema = {
  type: 'object',
  required: ['page', 'components'],
  properties: {
    page: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', minLength: 1 },
        data: { type: ['object', 'null'] },
      },
      additionalProperties: true,
    },
    pages: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', minLength: 1 },
          data: { type: ['object', 'null'] },
        },
        additionalProperties: true,
      },
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slot', 'slug'],
        properties: {
          slot: { type: 'string', minLength: 1 },
          slug: { type: 'string', minLength: 1 },
          data: { type: ['object', 'null'] },
        },
        additionalProperties: true,
      },
    },
    theme: {
      type: ['object', 'null'],
      properties: {
        slug: { type: 'string' },
        data: { type: ['object', 'null'] },
      },
      additionalProperties: true,
    },
    metadata: { type: ['object', 'null'] },
  },
  additionalProperties: false,
};

const validatePlan = ajv.compile(templatePlanSchema);

const DEFAULT_RETRY = 2;

interface AiChatClient {
  chat: (
    messages: Array<{ role: string; content: string }>,
    userId?: string,
    customPrompt?: string,
    model?: string,
  ) => Promise<string>;
}

let aiClient: AiChatClient | null = null;

function getAiService(): AiChatClient {
  if (aiClient) return aiClient;
  // 延迟加载避免在测试环境初始化真实依赖
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { aiService } = require('../ai');
  aiClient = aiService as AiChatClient;
  return aiClient;
}

function setAiService(service: AiChatClient | null) {
  aiClient = service;
}

export async function planTemplate(input: TemplatePlannerInput): Promise<TemplatePlannerResult> {
  const { userContext, scenario, filters = {}, userId, customPrompt, model } = input;
  const maxRetries = input.maxRetries ?? DEFAULT_RETRY;

  const promptResult = await composeSystemPrompt({ ...filters, scenario });
  const rawResponses: string[] = [];
  let attempts = 0;
  let lastError: string | undefined;

  for (const chunk of promptResult.prompts) {
    const allowedSlugs = new Set(chunk.templates.map((tpl) => tpl.slug));

    for (let retry = 0; retry <= maxRetries; retry += 1) {
      attempts += 1;
      try {
        const response = await getAiService().chat(
          [
            { role: 'system', content: chunk.prompt },
            { role: 'user', content: userContext },
          ],
          userId,
          customPrompt,
          model,
        );
        rawResponses.push(response);
        const plan = parsePlan(response);
        if (!plan) {
          lastError = 'Unable to parse TemplatePlan JSON';
          continue;
        }

        const validationError = validateTemplatePlan(plan, allowedSlugs);
        if (validationError) {
          lastError = validationError;
          continue;
        }

        return {
          success: true,
          plan,
          attempts,
          rawResponses,
          usedSlugs: Array.from(allowedSlugs),
          metadata: {
            chunksTried: promptResult.prompts.length,
            totalTemplates: promptResult.metadata.totalTemplates,
            chunkSize: promptResult.metadata.chunkSize,
            cachedAt: promptResult.metadata.cachedAt,
            filters,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;
        rawResponses.push(message);
        logger.warn('templatePlanner.retry', {
          attempt: attempts,
          reason: message,
        });
      }
    }
  }

  logger.error('templatePlanner.failed', {
    attempts,
    lastError,
  });

  return {
    success: false,
    plan: null,
    attempts,
    rawResponses,
    usedSlugs: [],
    error: lastError,
    metadata: {
      chunksTried: promptResult.prompts.length,
      totalTemplates: promptResult.metadata.totalTemplates,
      chunkSize: promptResult.metadata.chunkSize,
      cachedAt: promptResult.metadata.cachedAt,
      filters,
    },
  };
}

function parsePlan(raw: string): TemplatePlan | null {
  if (!raw) return null;
  try {
    const trimmed = raw.trim();
    const plan = JSON.parse(trimmed) as TemplatePlan;
    return plan;
  } catch {
    return null;
  }
}

function validateTemplatePlan(plan: TemplatePlan, allowedSlugs: Set<string>): string | undefined {
  const valid = validatePlan(plan);
  if (!valid) {
    const error = validatePlan.errors?.map((err) => `${err.instancePath} ${err.message}`).join(', ');
    return error || 'Invalid TemplatePlan structure';
  }

  if (!allowedSlugs.has(plan.page.slug)) {
    return `Page slug ${plan.page.slug} not in allowed list`;
  }

  if (Array.isArray(plan.pages)) {
    for (const page of plan.pages) {
      if (!allowedSlugs.has(page.slug)) {
        return `Additional page slug ${page.slug} not in allowed list`;
      }
    }
  }

  if (plan.components.some((component) => !allowedSlugs.has(component.slug))) {
    return 'One or more components use slugs outside the allowed list';
  }

  return undefined;
}

export const __testing = {
  setAiService,
  resetAiService() {
    setAiService(null);
  },
};
