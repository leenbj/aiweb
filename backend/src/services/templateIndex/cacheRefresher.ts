import { logger } from '../../utils/logger';
import { refreshTemplateIndex, onTemplateImported as refreshOnTemplateImported } from '../templateIndex';
import type { TemplateImportedPayload } from '../../events/templateEvents';

interface CacheRefresherOptions {
  enabled?: boolean;
  retryLimit?: number;
}

const DEFAULT_OPTIONS: Required<CacheRefresherOptions> = {
  enabled: true,
  retryLimit: 3,
};

let options: Required<CacheRefresherOptions> = { ...DEFAULT_OPTIONS };

export function configureCacheRefresher(partial: CacheRefresherOptions) {
  options = { ...options, ...partial };
}

export function resetCacheRefresherConfig() {
  options = { ...DEFAULT_OPTIONS };
}

export function attachTemplateImportListeners() {
  return refreshOnTemplateImported(async (payload) => {
    if (!options.enabled) {
      logger.info('cacheRefresher.skip', {
        importId: payload.importId,
        reason: 'disabled',
      });
      return;
    }

    await refreshWithRetry(payload, options.retryLimit);
  });
}

export async function refreshWithRetry(payload: TemplateImportedPayload, retries: number) {
  let attempts = 0;
  let lastError: unknown;

  while (attempts <= retries) {
    attempts += 1;
    try {
      await refreshTemplateIndex({
        reason: 'template-imported',
        importId: payload.importId,
        templateId: payload.components?.[0] || payload.pages?.[0],
        requestId: payload.requestId,
      });
      logger.info('cacheRefresher.success', {
        importId: payload.importId,
        attempts,
      });
      return true;
    } catch (error) {
      lastError = error;
      logger.warn('cacheRefresher.retry', {
        importId: payload.importId,
        attempt: attempts,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
    }
  }

  logger.error('cacheRefresher.failed', {
    importId: payload.importId,
    attempts,
    error: lastError instanceof Error ? { message: lastError.message, stack: lastError.stack } : lastError,
  });
  return false;
}
