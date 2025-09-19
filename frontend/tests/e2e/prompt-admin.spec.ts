import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const mockUser = {
  id: 'user_test',
  email: 'qa@example.com',
  name: 'QA Engineer',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((user) => {
    const state = {
      state: {
        user,
        token: 'playwright-token',
        isAuthenticated: true,
      },
      version: 0,
    };
    window.localStorage.setItem('auth-storage', JSON.stringify(state));
    window.localStorage.setItem('auth-token', 'playwright-token');
  }, mockUser);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockUser }),
    });
  });
});

test('Prompt 管理支持批量导入与重试', async ({ page }) => {
  const promptListFirst = {
    items: [
      {
        prompt: {
          id: 'prompt_1',
          name: 'landing-hero',
          tags: ['hero'],
          status: 'FAILED',
          source: 'OPERATION',
          targetSlug: null,
          latestJobId: null,
          rawText: '# hero',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        latestRun: null,
        latestJob: null,
        jobs: [],
        templateSummaries: [],
        templateSlugs: [],
        previewUrls: [],
        artifactPath: null,
        statistics: { totalRuns: 0, totalJobs: 0 },
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    hasNextPage: false,
  };

  const promptListAfter = {
    ...promptListFirst,
    items: [
      ...promptListFirst.items,
      {
        prompt: {
          id: 'prompt_new',
          name: 'prompt-new',
          tags: ['demo'],
          status: 'PENDING',
          source: 'OPERATION',
          targetSlug: null,
          latestJobId: null,
          rawText: 'demo prompt',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        latestRun: null,
        latestJob: null,
        jobs: [],
        templateSummaries: [],
        templateSlugs: [],
        previewUrls: [],
        artifactPath: null,
        statistics: { totalRuns: 0, totalJobs: 0 },
      },
    ],
    total: 2,
  };

  let listCall = 0;
  await page.route('**/api/prompts?**', async (route) => {
    listCall += 1;
    const payload = listCall > 1 ? promptListAfter : promptListFirst;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: payload }),
    });
  });

  const promptDetail = {
    prompt: promptListFirst.items[0].prompt,
    runs: [],
    jobs: [],
  };

  await page.route('**/api/prompts/prompt_1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: promptDetail }),
    });
  });

  await page.route('**/api/prompts/prompt_new', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          prompt: promptListAfter.items[1].prompt,
          runs: [],
          jobs: [],
        },
      }),
    });
  });

  await page.route('**/api/prompts/import', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          created: [{ promptId: 'prompt_new' }],
          skipped: [],
        },
      }),
    });
  });

  await page.route('**/api/prompts/prompt_new/retry', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { promptId: 'prompt_new', jobId: 'job', runId: 'run' } }),
    });
  });

  await page.goto(`${APP_URL}/prompts`);

  await expect(page.getByText('landing-hero')).toBeVisible();
  await page.getByText('landing-hero').click();
  await expect(page.getByText('重新入队')).toBeVisible();

  await page.getByRole('button', { name: '批量导入' }).click();
  const modal = page.getByText('批量导入提示词');
  await expect(modal).toBeVisible();

  await page.fill('textarea[placeholder^="["]', '[{"name":"prompt-new","rawText":"## demo"}]');
  await page.getByRole('button', { name: '确认导入' }).click();

  await expect(modal).toBeHidden({ timeout: 3000 });
  await expect(page.getByText('prompt-new')).toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: '重新入队' }).click();
  await expect(page.getByText('提示词已重新排队')).toBeVisible({ timeout: 3000 });
});

