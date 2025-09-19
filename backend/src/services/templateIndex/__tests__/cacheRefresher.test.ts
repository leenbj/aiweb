import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { emitTemplateImported, removeAllTemplateEventListeners } from '../../../events/templateEvents';
import { attachTemplateImportListeners, configureCacheRefresher, resetCacheRefresherConfig } from '../cacheRefresher';
import { __testing as templateIndexTesting } from '../../templateIndex';

let refreshCalls: any[] = [];

beforeEach(() => {
  refreshCalls = [];
  templateIndexTesting.resetCache();
  templateIndexTesting.setPrismaClient({ template: { findMany: async () => [], count: async () => 0 } });
  configureCacheRefresher({ enabled: true, retryLimit: 1 });

  templateIndexTesting.setRefreshExecutor(async (context: any) => {
    refreshCalls.push(context);
  });

  attachTemplateImportListeners();
});

afterEach(() => {
  resetCacheRefresherConfig();
  templateIndexTesting.resetCache();
  templateIndexTesting.resetPrismaClient();
  templateIndexTesting.resetRefreshExecutor();
  removeAllTemplateEventListeners();
});

test('refreshes cache when template imported', async () => {
  emitTemplateImported({ importId: 'imp-1', userId: 'user', pages: ['page'], components: ['hero'], durationMs: 1000 });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(refreshCalls.length > 0, true);
  assert.equal(refreshCalls[0].reason, 'template-imported');
});

test('skips when disabled', async () => {
  configureCacheRefresher({ enabled: false });
  refreshCalls.length = 0;

  emitTemplateImported({ importId: 'imp-2', userId: 'user', pages: [], components: [], durationMs: 1000 });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(refreshCalls.length, 0);
});
