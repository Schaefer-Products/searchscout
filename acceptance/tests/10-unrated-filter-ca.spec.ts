import { test, expect, Page } from '@playwright/test';
import {
  clearIndexedDb,
  seedCredentials,
  seedCurrentDomain,
  seedSelectedCompetitors,
  seedDomainCache,
  seedCompetitorAnalysisCache,
  seedKeywordRatings,
} from '../support/idb-helpers';
import { stubCompetitorKeywords } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';
import { CompetitorAnalysisPage } from '../pages/competitor-analysis.page';
import { KeywordRatingPage } from '../pages/keyword-rating.page';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const USER_KEYWORDS = [
  { keyword: 'seo tools', searchVolume: 12000, difficulty: 45, position: 4, etv: 480, cpc: 2.5 },
  { keyword: 'keyword research', searchVolume: 8100, difficulty: 38, position: 2, etv: 2700, cpc: 1.8 },
];

const COMPETITORS = [
  { domain: 'competitor-a.com', keywordOverlap: 850, totalKeywords: 2100, isManual: false },
  { domain: 'competitor-b.com', keywordOverlap: 620, totalKeywords: 1800, isManual: false },
  { domain: 'competitor-c.com', keywordOverlap: 430, totalKeywords: 1200, isManual: false },
];

// Cached analysis results:
//   opportunities  = ['link building', 'backlink checker']  (2 keywords)
//   shared         = ['seo tools']                          (1 keyword)
//   uniqueToUser   = ['keyword research']                   (1 keyword)
//   allKeywords    = all 4 above
const CACHED_ANALYSIS_RESULTS = {
  allKeywords: [
    {
      keyword: 'link building',
      searchVolume: 9000,
      difficulty: 55,
      competitorCount: 3,
      isOpportunity: true,
      competitorRankings: [
        { domain: 'competitor-a.com', position: 3 },
        { domain: 'competitor-b.com', position: 4 },
        { domain: 'competitor-c.com', position: 6 },
      ],
      opportunityScore: 34,
      cpc: 3.20,
    },
    {
      keyword: 'backlink checker',
      searchVolume: 6500,
      difficulty: 60,
      competitorCount: 3,
      isOpportunity: true,
      competitorRankings: [
        { domain: 'competitor-a.com', position: 5 },
        { domain: 'competitor-b.com', position: 7 },
        { domain: 'competitor-c.com', position: 9 },
      ],
      opportunityScore: 31,
      cpc: 4.10,
    },
    {
      keyword: 'seo tools',
      searchVolume: 12000,
      difficulty: 45,
      competitorCount: 3,
      isOpportunity: false,
      userRanking: { position: 4, etv: 480 },
      competitorRankings: [
        { domain: 'competitor-a.com', position: 2 },
        { domain: 'competitor-b.com', position: 3 },
        { domain: 'competitor-c.com', position: 5 },
      ],
      opportunityScore: 0,
      cpc: 2.50,
    },
    {
      keyword: 'keyword research',
      searchVolume: 8100,
      difficulty: 38,
      competitorCount: 0,
      isOpportunity: false,
      userRanking: { position: 2, etv: 2700 },
      competitorRankings: [],
      opportunityScore: 0,
      cpc: 1.80,
    },
  ],
  opportunities: [
    {
      keyword: 'link building',
      searchVolume: 9000,
      difficulty: 55,
      competitorCount: 3,
      isOpportunity: true,
      competitorRankings: [
        { domain: 'competitor-a.com', position: 3 },
        { domain: 'competitor-b.com', position: 4 },
        { domain: 'competitor-c.com', position: 6 },
      ],
      opportunityScore: 34,
      cpc: 3.20,
    },
    {
      keyword: 'backlink checker',
      searchVolume: 6500,
      difficulty: 60,
      competitorCount: 3,
      isOpportunity: true,
      competitorRankings: [
        { domain: 'competitor-a.com', position: 5 },
        { domain: 'competitor-b.com', position: 7 },
        { domain: 'competitor-c.com', position: 9 },
      ],
      opportunityScore: 31,
      cpc: 4.10,
    },
  ],
  shared: [
    {
      keyword: 'seo tools',
      searchVolume: 12000,
      difficulty: 45,
      competitorCount: 3,
      isOpportunity: false,
      userRanking: { position: 4, etv: 480 },
      competitorRankings: [
        { domain: 'competitor-a.com', position: 2 },
        { domain: 'competitor-b.com', position: 3 },
        { domain: 'competitor-c.com', position: 5 },
      ],
      opportunityScore: 0,
      cpc: 2.50,
    },
  ],
  uniqueToUser: [
    {
      keyword: 'keyword research',
      searchVolume: 8100,
      difficulty: 38,
      competitorCount: 0,
      isOpportunity: false,
      userRanking: { position: 2, etv: 2700 },
      competitorRankings: [],
      opportunityScore: 0,
      cpc: 1.80,
    },
  ],
  totalKeywords: 4,
  analyzedCompetitors: ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
  timestamp: Date.now(),
};

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

async function baseSetup(page: Page): Promise<void> {
  await clearIndexedDb(page);
  await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  await seedCurrentDomain(page, 'example.com');
  await seedDomainCache(page, 'example.com', USER_KEYWORDS as any[]);
  await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
  await seedCompetitorAnalysisCache(
    page,
    'example.com',
    ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
    CACHED_ANALYSIS_RESULTS as Record<string, unknown>,
    0
  );
  await stubCompetitorKeywords(page, 'standard');
}

async function navigateToAnalysis(page: Page): Promise<CompetitorAnalysisPage> {
  const dashboard = new DashboardPage(page);
  const analysis = new CompetitorAnalysisPage(page);
  await page.goto('/dashboard');
  await dashboard.waitForResults();
  await dashboard.startAnalysisButton.click();
  await analysis.waitForAnalysisComplete();
  return analysis;
}

// Locator helper — scoped to the competitor analysis container to avoid
// colliding with the dashboard's own unrated toggle button.
function unratedToggle(page: Page) {
  return page.locator('.competitor-analysis-container .btn-toggle-unrated');
}

// Extract the integer N from text like "Show unrated only (N)" or "Showing unrated only (N)".
async function getUnratedCount(page: Page): Promise<number> {
  const text = (await unratedToggle(page).textContent()) ?? '';
  const match = text.match(/\((\d+)\)/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

// ---------------------------------------------------------------------------
// Rule 1: Button label and count per view
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 1: Button label and count', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('button shows "Show unrated only (N)" with all keywords unrated in opportunities view', async ({ page }) => {
    await navigateToAnalysis(page);

    await expect(unratedToggle(page)).toBeVisible();
    const count = await getUnratedCount(page);
    expect(count).toBe(2); // opportunities: link building, backlink checker
    await expect(unratedToggle(page)).toContainText('Show unrated only');
  });

  test('count reflects only truly unrated keywords when some are pre-rated in opportunities view', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'link building': 2 });
    await navigateToAnalysis(page);

    const count = await getUnratedCount(page);
    expect(count).toBe(1);
  });

  test('button label changes to "Showing unrated only (N)" while filter is active', async ({ page }) => {
    await navigateToAnalysis(page);

    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toContainText('Showing unrated only');
  });

  test('unrated count reflects keywords in the all keywords view', async ({ page }) => {
    await navigateToAnalysis(page);
    const analysis = new CompetitorAnalysisPage(page);
    await analysis.clickTab('All Keywords');

    const count = await getUnratedCount(page);
    expect(count).toBe(4); // all 4 keywords unrated
  });

  test('unrated count reflects keywords in the shared tab', async ({ page }) => {
    await navigateToAnalysis(page);
    const analysis = new CompetitorAnalysisPage(page);
    await analysis.clickTab('Shared');

    const count = await getUnratedCount(page);
    expect(count).toBe(1); // only 'seo tools'
  });

  test('unrated count reflects keywords in the unique tab', async ({ page }) => {
    await navigateToAnalysis(page);
    const analysis = new CompetitorAnalysisPage(page);
    await analysis.clickTab('Your Unique');

    const count = await getUnratedCount(page);
    expect(count).toBe(1); // only 'keyword research'
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Button visibility per view mode
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 2: Button visibility', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('button is NOT visible in the blog-topics view', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('Blog Topics');

    await expect(unratedToggle(page)).not.toBeVisible();
  });

  test('button IS visible in the opportunities view', async ({ page }) => {
    await navigateToAnalysis(page);

    await expect(unratedToggle(page)).toBeVisible();
  });

  test('button IS visible in the all keywords view', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('All Keywords');

    await expect(unratedToggle(page)).toBeVisible();
  });

  test('button IS visible in the shared view', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('Shared');

    await expect(unratedToggle(page)).toBeVisible();
  });

  test('button IS visible in the unique-to-user view', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('Your Unique');

    await expect(unratedToggle(page)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Filtering behaviour — show only unrated
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 3: Filtering to unrated keywords', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'link building': 2 });
  });

  test('clicking the button filters the opportunities table to unrated keywords only', async ({ page }) => {
    await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    // Before filter: both opportunity rows visible
    expect(await rating.isKeywordVisible('link building')).toBe(true);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);

    await unratedToggle(page).click();

    // After filter: only unrated 'backlink checker' visible
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
    expect(await rating.isKeywordVisible('link building')).toBe(false);
  });

  test('clicking the button filters the all keywords table to unrated keywords only', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('All Keywords');

    const rating = new KeywordRatingPage(page);

    await unratedToggle(page).click();

    // 'link building' rated 2 — should be hidden; others visible
    expect(await rating.isKeywordVisible('link building')).toBe(false);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
  });

  test('button carries the active modifier class when filter is on', async ({ page }) => {
    await navigateToAnalysis(page);

    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
  });

  test('button does not have the active modifier class when filter is off', async ({ page }) => {
    await navigateToAnalysis(page);

    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Real-time count decrement while filter is active
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 4: Count decrements in real time', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('rating a keyword while filter is active removes it from view and decrements count', async ({ page }) => {
    await navigateToAnalysis(page);

    // Activate filter — both opportunities unrated, count = 2
    await unratedToggle(page).click();
    expect(await getUnratedCount(page)).toBe(2);

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('link building', 3);

    // Count drops to 1; rated keyword leaves the view
    expect(await getUnratedCount(page)).toBe(1);
    expect(await rating.isKeywordVisible('link building')).toBe(false);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
  });

  test('unrated count on the button decrements for every keyword rated while filter is inactive', async ({ page }) => {
    await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    // Rate first keyword — count goes from 2 to 1
    await rating.clickRating('link building', 1);
    expect(await getUnratedCount(page)).toBe(1);

    // Rate second keyword — count goes to 0
    await rating.clickRating('backlink checker', 2);
    expect(await getUnratedCount(page)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 5: Deactivating the filter
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 5: Deactivating the filter', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'link building': 2 });
  });

  test('clicking the active button deactivates the filter and shows all keywords', async ({ page }) => {
    await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    await unratedToggle(page).click(); // activate
    await unratedToggle(page).click(); // deactivate

    expect(await rating.isKeywordVisible('link building')).toBe(true);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });

  test('button label reverts to "Show unrated only" after deactivation', async ({ page }) => {
    await navigateToAnalysis(page);

    await unratedToggle(page).click();
    await unratedToggle(page).click();

    await expect(unratedToggle(page)).toContainText('Show unrated only');
  });
});

// ---------------------------------------------------------------------------
// Rule 6: Completion state when all keywords in current view are rated
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 6: Completion state', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('completion state appears when filter is active and all keywords are already rated', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'link building': 1, 'backlink checker': 2 });
    await navigateToAnalysis(page);

    await unratedToggle(page).click();

    await expect(page.locator('.competitor-analysis-container .unrated-complete-state')).toBeVisible();
    expect(await getUnratedCount(page)).toBe(0);
  });

  test('completion state appears after rating the last unrated keyword while filter is active', async ({ page }) => {
    await navigateToAnalysis(page);

    await unratedToggle(page).click();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('link building', 1);
    await rating.clickRating('backlink checker', 2);

    await expect(page.locator('.competitor-analysis-container .unrated-complete-state')).toBeVisible();
  });

  test('completion state is not visible when filter is inactive even if all keywords are rated', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'link building': 1, 'backlink checker': 2 });
    await navigateToAnalysis(page);

    // Filter is off — normal table renders, not completion state
    await expect(page.locator('.competitor-analysis-container .unrated-complete-state')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 7: Switching view mode deactivates the filter
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 7: Switching view mode deactivates filter', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'link building': 2 });
  });

  test('switching from opportunities to all keywords resets the filter to inactive', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);

    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    await analysis.clickTab('All Keywords');

    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });

  test('switching from all keywords to shared resets the filter to inactive', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    await analysis.clickTab('All Keywords');

    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    await analysis.clickTab('Shared');

    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });

  test('after filter resets on view switch, all keywords in new view are visible', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    await unratedToggle(page).click(); // activate — hides 'link building'
    expect(await rating.isKeywordVisible('link building')).toBe(false);

    await analysis.clickTab('All Keywords'); // view switch resets filter

    // Both keywords should now be visible in all keywords view
    expect(await rating.isKeywordVisible('link building')).toBe(true);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
  });

  test('filter state is reset when switching back to opportunities from another tab', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);

    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    await analysis.clickTab('Shared');
    await analysis.clickTab('Opportunities');

    await expect(unratedToggle(page)).not.toHaveClass(/unrated-filter-active/);
  });
});

// ---------------------------------------------------------------------------
// Rule 8: Filter persists through sorting within same view
// ---------------------------------------------------------------------------

test.describe('CA Unrated Filter — Rule 8: Filter persists through sorting', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
    await seedKeywordRatings(page, 'example.com', { 'link building': 2 });
  });

  test('filter remains active after clicking the difficulty column header to sort', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    await unratedToggle(page).click();
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);

    await analysis.difficultyHeader.click();

    // Filter must still be active and the rated keyword absent
    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
    expect(await rating.isKeywordVisible('link building')).toBe(false);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
  });

  test('filter remains active after clicking a second column header', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);

    await unratedToggle(page).click();

    await analysis.volumeHeader.click();
    await analysis.difficultyHeader.click();

    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
  });

  test('filter remains active after sorting by opportunity score in opportunities view', async ({ page }) => {
    const analysis = await navigateToAnalysis(page);
    const rating = new KeywordRatingPage(page);

    await unratedToggle(page).click();

    await analysis.opportunityScoreHeader.click();

    await expect(unratedToggle(page)).toHaveClass(/unrated-filter-active/);
    expect(await rating.isKeywordVisible('link building')).toBe(false);
    expect(await rating.isKeywordVisible('backlink checker')).toBe(true);
  });
});
