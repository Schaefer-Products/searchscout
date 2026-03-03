import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials, seedCurrentDomain, seedDomainCache } from '../support/idb-helpers';
import { stubDomainKeywords } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Domain Keyword Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  });

  test('first analysis shows table with 2 rows, 4 stat cards, and cache info badge', async ({ page }) => {
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    await expect(dashboard.keywordRows).toHaveCount(2);
    await expect(dashboard.statCards).toHaveCount(4);
    await expect(dashboard.cacheDataBadge).toBeVisible();
    await expect(dashboard.freshDataBadge).not.toBeVisible();
  });

  test('invalid domain input shows validation error without calling the API', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/ranked_keywords/live', async (route) => {
      apiCalled = true;
      await route.continue();
    });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('not_a_valid_domain!!!');
    await dashboard.waitForEmptyOrError();

    await expect(dashboard.errorMessage).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('domain with no keywords shows error state and no table', async ({ page }) => {
    await stubDomainKeywords(page, 'empty');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('newdomain.com');
    await dashboard.waitForEmptyOrError();

    await expect(dashboard.errorMessage).toBeVisible();
    await expect(dashboard.keywordRows).toHaveCount(0);
  });

  test('clicking Search Volume header sorts keyword rows by volume', async ({ page }) => {
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    // Initial order from fixture: "seo tools" first (index 0), "keyword research" second
    await expect(dashboard.firstKeywordText).toHaveText('seo tools');

    // First click: sort by search volume ascending → "keyword research" (8100) first
    await dashboard.searchVolumeHeader.click();
    await expect(dashboard.firstKeywordText).toHaveText('keyword research');

    // Second click: sort descending → "seo tools" (12000) first
    await dashboard.searchVolumeHeader.click();
    await expect(dashboard.firstKeywordText).toHaveText('seo tools');
  });

  test('cached data badge appears on reload when cache exists', async ({ page }) => {
    // Pre-seed domain and cache so addInitScript re-applies them on every navigation (including reload)
    const keywords = [
      { keyword: 'seo tools', searchVolume: 12000, difficulty: 45, position: 4 },
      { keyword: 'keyword research', searchVolume: 8100, difficulty: 38, position: 2 },
    ];
    await seedCurrentDomain(page, 'example.com');
    await seedDomainCache(page, 'example.com', keywords);
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    // ngOnInit finds savedDomain + cache → auto-analyzes without user interaction
    await dashboard.waitForResults();
    await expect(dashboard.cacheDataBadge).toBeVisible();

    // Reload — APP_INITIALIZER re-reads IDB (re-seeded by addInitScript), auto-analyzes again
    await page.reload();
    await dashboard.waitForResults();

    await expect(dashboard.cacheDataBadge).toBeVisible();
    await expect(dashboard.freshDataBadge).not.toBeVisible();
  });
});
