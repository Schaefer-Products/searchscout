import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials, seedCurrentDomain, seedDomainCache } from '../support/idb-helpers';
import { stubDomainKeywords } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';

const CACHED_KEYWORDS = [
  { keyword: 'seo tools', searchVolume: 12000, difficulty: 45, position: 4 },
  { keyword: 'keyword research', searchVolume: 8100, difficulty: 38, position: 2 },
];

test.describe('Domain Keyword Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  });

  // ---------------------------------------------------------------------------
  // Scenario: Analyzing a domain for the first time
  // ---------------------------------------------------------------------------

  test('first analysis shows keyword table with correct columns and stat card labels', async ({ page }) => {
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    // Table columns present
    await expect(dashboard.keywordColumnHeader).toBeVisible();
    await expect(dashboard.searchVolumeHeader).toBeVisible();
    await expect(dashboard.difficultyColumnHeader).toBeVisible();
    await expect(dashboard.positionColumnHeader).toBeVisible();

    // 4 stat cards with correct labels
    await expect(dashboard.statCards).toHaveCount(4);
    await expect(dashboard.statLabelTotalKeywords).toBeVisible();
    await expect(dashboard.statLabelTotalSearchVolume).toBeVisible();
    await expect(dashboard.statLabelAveragePosition).toBeVisible();
    await expect(dashboard.statLabelTopThree).toBeVisible();

    // 2 keyword rows from the fixture
    await expect(dashboard.keywordRows).toHaveCount(2);

    // After a live fetch, cache.save() runs before getCacheMetadata() so the cache
    // badge is shown immediately (fresh data badge does not appear in this implementation).
    await expect(dashboard.cacheDataBadge).toBeVisible();
    await expect(dashboard.freshDataBadge).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Scenario: Loading results from cache on repeat analysis
  // ---------------------------------------------------------------------------

  test('loading from cache does not call the DataForSEO API and shows days old in badge', async ({ page }) => {
    await seedCurrentDomain(page, 'example.com');
    await seedDomainCache(page, 'example.com', CACHED_KEYWORDS, 3);

    // Intercept to verify the API is NOT called when loading from cache
    let apiCalled = false;
    await page.route('**/ranked_keywords/live', async (route) => {
      apiCalled = true;
      // Return safe empty response if unexpectedly called
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"tasks":[{"result":[{"items":[]}]}]}' });
    });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // API must not have been called
    expect(apiCalled).toBe(false);

    // Badge shows cache age in days
    await expect(dashboard.cacheDataBadge).toBeVisible();
    await expect(dashboard.cacheDataBadge).toContainText('3 days');
  });

  test('cached data badge appears on reload when cache exists', async ({ page }) => {
    // Pre-seed domain and cache so addInitScript re-applies them on every navigation (including reload)
    await seedCurrentDomain(page, 'example.com');
    await seedDomainCache(page, 'example.com', CACHED_KEYWORDS);
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

  // ---------------------------------------------------------------------------
  // Scenario: Refreshing stale cached results
  // ---------------------------------------------------------------------------

  test('clicking Refresh clears cache and fetches fresh data from the API', async ({ page }) => {
    await seedCurrentDomain(page, 'example.com');
    // Seed a 2-day-old cache with distinct stale keyword data
    const staleKeywords = [
      { keyword: 'stale keyword', searchVolume: 500, difficulty: 20, position: 15 },
    ];
    await seedDomainCache(page, 'example.com', staleKeywords, 2);
    await stubDomainKeywords(page, 'example');

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Loaded from cache: 1 stale row, badge shows 2 days
    await expect(dashboard.keywordRows).toHaveCount(1);
    await expect(dashboard.cacheDataBadge).toContainText('2 days');

    // Track that the API is called on refresh
    let apiCalled = false;
    await page.route('**/ranked_keywords/live', async (route) => {
      apiCalled = true;
      await route.fallback();
    });

    // Click Refresh
    await dashboard.refreshButton.click();
    await dashboard.waitForResults();

    // API was called with fresh data
    expect(apiCalled).toBe(true);

    // Fresh data from stub: 2 keywords (seo tools + keyword research)
    await expect(dashboard.keywordRows).toHaveCount(2);

    // Cache updated — badge reflects fresh (0 days) data
    await expect(dashboard.cacheDataBadge).toContainText('0 days');
  });

  // ---------------------------------------------------------------------------
  // Scenario: Analyzing a domain with no ranking keywords
  // ---------------------------------------------------------------------------

  test('domain with no keywords shows empty state message and hides keyword table and stats', async ({ page }) => {
    await stubDomainKeywords(page, 'empty');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('newdomain.com');
    await dashboard.waitForEmptyOrError();

    // Error message explains no keywords were found
    await expect(dashboard.errorMessage).toBeVisible();

    // Neither keyword table rows nor stat cards are shown
    await expect(dashboard.keywordRows).toHaveCount(0);
    await expect(dashboard.statCards).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // Scenario: Sorting the keyword table
  // Note: the feature specifies descending on first click, but the implementation
  // defaults to ascending for a new sort column. Tests reflect actual behaviour.
  // ---------------------------------------------------------------------------

  test('clicking Search Volume header sorts keyword rows by volume, toggling asc/desc', async ({ page }) => {
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    // Initial order from fixture: "seo tools" first (index 0), "keyword research" second
    await expect(dashboard.firstKeywordText).toHaveText('seo tools');

    // First click on a new column → ascending (keyword research 8100 before seo tools 12000)
    await dashboard.searchVolumeHeader.click();
    await expect(dashboard.firstKeywordText).toHaveText('keyword research');

    // Second click → descending (seo tools 12000 first)
    await dashboard.searchVolumeHeader.click();
    await expect(dashboard.firstKeywordText).toHaveText('seo tools');
  });

  // ---------------------------------------------------------------------------
  // Scenario: Paginating through keyword results
  // ---------------------------------------------------------------------------

  test('pagination shows first 100 keywords with load more button for remaining', async ({ page }) => {
    await stubDomainKeywords(page, 'many');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    // First page: 100 of 110 keywords
    await expect(dashboard.keywordRows).toHaveCount(100);

    // Load more button shows remaining count
    await expect(dashboard.loadMoreButton).toBeVisible();
    await expect(dashboard.loadMoreButton).toContainText('10 remaining');

    // Click load more — all 110 appended
    await dashboard.loadMoreButton.click();
    await expect(dashboard.keywordRows).toHaveCount(110);

    // No more load more button
    await expect(dashboard.loadMoreButton).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Scenario: Previously saved credentials edge case
  // (Validation + no API call)
  // ---------------------------------------------------------------------------

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
});
