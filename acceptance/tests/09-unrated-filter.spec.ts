import { test, expect, Page } from '@playwright/test';
import {
  clearIndexedDb,
  seedCredentials,
  seedCurrentDomain,
  seedDomainCache,
  seedKeywordRatings,
} from '../support/idb-helpers';
import { DashboardPage } from '../pages/dashboard.page';
import { KeywordRatingPage } from '../pages/keyword-rating.page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TWO_KEYWORDS = [
  { keyword: 'seo tools', searchVolume: 12000, difficulty: 45, position: 4, etv: 480, cpc: 2.5 },
  { keyword: 'keyword research', searchVolume: 8100, difficulty: 38, position: 2, etv: 2700, cpc: 1.8 },
];

const MANY_KEYWORDS: Array<Record<string, unknown>> = Array.from({ length: 110 }, (_, i) => ({
  keyword: `keyword ${i + 1}`,
  searchVolume: 1000 + i * 10,
  difficulty: 30,
  position: i + 1,
  etv: 100,
  cpc: 1.0,
}));

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

async function baseSetup(page: Page): Promise<void> {
  await clearIndexedDb(page);
  await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  await seedCurrentDomain(page, 'example.com');
  await seedDomainCache(page, 'example.com', TWO_KEYWORDS as any[]);
}

// Locator helper — keeps all tests consistent with the UI spec class name.
function unratedToggle(page: Page) {
  return page.locator('.btn-toggle-unrated');
}

// Extract the integer N from text like "Show unrated only (N)" or "Showing unrated only (N)".
async function getUnratedCount(page: Page): Promise<number> {
  const text = (await unratedToggle(page).textContent()) ?? '';
  const match = text.match(/\((\d+)\)/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

// ---------------------------------------------------------------------------
// Rule 1: Button label and count
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 1: Button label and count', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('button shows "Show unrated only (N)" with correct unrated count', async ({ page }) => {
    // Both keywords unrated — expect count 2
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await expect(unratedToggle(page)).toBeVisible();
    const count = await getUnratedCount(page);
    expect(count).toBe(2);
    await expect(unratedToggle(page)).toContainText('Show unrated only');
  });

  test('count reflects only truly unrated keywords when some are pre-rated', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });

    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const count = await getUnratedCount(page);
    expect(count).toBe(1);
  });

  test('button label changes to "Showing unrated only (N)" while filter is active', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toContainText('Showing unrated only');
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Button visibility
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 2: Button visibility', () => {
  test('button is not visible before keywords are loaded (no analysis run)', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    // No domain or cache seeded — the form is empty, no results shown.

    await page.goto('/dashboard');

    await expect(unratedToggle(page)).not.toBeVisible();
  });

  test('button is visible once keywords are loaded', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await expect(unratedToggle(page)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Filtering behaviour — show only unrated
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 3: Filtering to unrated keywords', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });
  });

  test('clicking the button filters the table to show only unrated keywords', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Before filter: both rows visible
    const rating = new KeywordRatingPage(page);
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);

    await unratedToggle(page).click();

    // After filter: only unrated 'keyword research' visible
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
  });

  test('button carries the active modifier class when filter is on', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
  });

  test('button does not have the active modifier class when filter is off', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Filter is off by default
    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Real-time count decrement while filter is active
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 4: Count decrements in real time', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('rating a keyword while filter is active removes it from view and decrements count', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Activate filter — both keywords unrated, count = 2
    await unratedToggle(page).click();
    expect(await getUnratedCount(page)).toBe(2);

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 3);

    // Count should drop to 1 and the rated keyword should leave the view
    expect(await getUnratedCount(page)).toBe(1);
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);
  });

  test('unrated count on the button decrements for every keyword rated', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    // Rate first keyword — count goes from 2 to 1
    await rating.clickRating('seo tools', 1);
    expect(await getUnratedCount(page)).toBe(1);

    // Rate second keyword — count goes to 0
    await rating.clickRating('keyword research', 2);
    expect(await getUnratedCount(page)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 5: Deactivating the filter
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 5: Deactivating the filter', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });
  });

  test('clicking the active button deactivates the filter and shows all keywords', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click(); // activate
    await unratedToggle(page).click(); // deactivate

    const rating = new KeywordRatingPage(page);
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);
    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });

  test('button label reverts to "Show unrated only" after deactivation', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();
    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toContainText('Show unrated only');
  });
});

// ---------------------------------------------------------------------------
// Rule 6: Completion state when all keywords are rated
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 6: Completion state', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('completion state appears when filter is active and all keywords become rated', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 1, 'keyword research': 2 });

    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    await expect(page.locator('.unrated-complete-state')).toBeVisible();
    expect(await getUnratedCount(page)).toBe(0);
  });

  test('completion state appears after rating the last unrated keyword while filter is active', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 1);
    await rating.clickRating('keyword research', 2);

    await expect(page.locator('.unrated-complete-state')).toBeVisible();
  });

  test('completion state is not visible when filter is inactive even if all keywords are rated', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 1, 'keyword research': 2 });

    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Filter is off — normal table should render, not completion state
    await expect(page.locator('.unrated-complete-state')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 7: Filter resets on domain switch
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 7: Filter resets on domain switch', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedDomainCache(page, 'other.com', TWO_KEYWORDS as any[]);
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });
  });

  test('filter state is reset to inactive when user switches domain', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click(); // activate for example.com
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    await dashboard.analyzeDomain('other.com');
    await dashboard.waitForResults();

    // Filter must be off after domain switch
    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });

  test('all keywords are visible after domain switch (filter did not carry over)', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    await dashboard.analyzeDomain('other.com');
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 8: Filter persists through sorting
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 8: Filter persists through sorting', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });
  });

  test('filter remains active after clicking a sortable column header', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    // Click the Keyword column header to toggle sort
    await dashboard.keywordColumnHeader.click();

    // Filter must still be active and the rated keyword absent
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
    const rating = new KeywordRatingPage(page);
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
    expect(await rating.isKeywordVisible('keyword research')).toBe(true);
  });

  test('filter remains active after clicking a second column header', async ({ page }) => {
    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    await unratedToggle(page).click();

    await dashboard.searchVolumeHeader.click();
    await dashboard.difficultyColumnHeader.click();

    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
  });
});

// ---------------------------------------------------------------------------
// Rule 9: Filter persists through Load More pagination
// ---------------------------------------------------------------------------

test.describe('Unrated Filter — Rule 9: Filter persists through Load More pagination', () => {
  test('filter stays active and rated keywords stay hidden after Load More', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    // 110 keywords; rate keyword 1 (rated 2 = visible but rated, so excluded from unrated view)
    await seedDomainCache(page, 'example.com', MANY_KEYWORDS);
    await seedKeywordRatings(page, 'example.com', { 'keyword 1': 2 });

    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Activate filter — 109 unrated remain (keyword 1 is rated)
    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
    expect(await getUnratedCount(page)).toBe(109);

    // Load More
    await expect(dashboard.loadMoreButton).toBeVisible();
    await dashboard.loadMoreButton.click();

    // Filter must still be active
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    // The rated keyword must not appear anywhere in the table
    const ratingPage = new KeywordRatingPage(page);
    expect(await ratingPage.isKeywordVisible('keyword 1')).toBe(false);
  });

  test('unrated count reflects all unrated keywords across all pages, not just displayed page', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    await seedDomainCache(page, 'example.com', MANY_KEYWORDS);
    // Rate the first 5 keywords
    const ratings: Record<string, number> = {};
    for (let i = 1; i <= 5; i++) {
      ratings[`keyword ${i}`] = 1;
    }
    await seedKeywordRatings(page, 'example.com', ratings);

    await page.goto('/dashboard');
    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // Count must reflect all 110 - 5 = 105 unrated keywords, not just the first page
    const count = await getUnratedCount(page);
    expect(count).toBe(105);
  });
});
