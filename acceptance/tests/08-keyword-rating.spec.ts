import { test, expect, Page } from '@playwright/test';
import {
  clearIndexedDb,
  seedCredentials,
  seedCurrentDomain,
  seedSelectedCompetitors,
  seedDomainCache,
  seedCompetitorAnalysisCache,
  seedKeywordRatings,
  readKeywordRatingsFromIdb,
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
}

async function setupWithCompetitorCache(page: Page): Promise<void> {
  await baseSetup(page);
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

async function navigateAndStartAnalysis(
  page: Page,
  dashboard: DashboardPage,
  analysis: CompetitorAnalysisPage
): Promise<void> {
  await page.goto('/dashboard');
  await dashboard.waitForResults();
  await dashboard.startAnalysisButton.click();
  await analysis.waitForAnalysisComplete();
}

// ---------------------------------------------------------------------------
// Rule 1: Rating a keyword
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 1: Rating a keyword', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('clicking an emoji button selects the rating and marks it as active on the row', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 3);

    const current = await rating.getCurrentRating('seo tools');
    expect(current).toBe(3);
  });

  test('rating control is visible on each keyword row in the domain keywords table', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await expect(rating.getRatingControl('seo tools')).toBeVisible();
    await expect(rating.getRatingControl('keyword research')).toBeVisible();
  });

  test('rating persists after page reload (loaded from IndexedDB)', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('keyword research', 2);

    // Verify it was saved to IDB before reload
    const saved = await readKeywordRatingsFromIdb(page, 'example.com');
    expect(saved['keyword research']).toBe(2);

    await page.reload();
    await dashboard.waitForResults();

    const afterReload = await rating.getCurrentRating('keyword research');
    expect(afterReload).toBe(2);
  });

  test('rating appears on the same keyword in the competitor analysis shared tab', async ({ page }) => {
    await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_ANALYSIS_RESULTS as Record<string, unknown>,
      0
    );
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 3 });
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);
    await analysis.clickTab('Shared');

    const current = await rating.getCurrentRating('seo tools');
    expect(current).toBe(3);
  });

  test('rating appears on the same keyword in the competitor analysis all keywords tab', async ({ page }) => {
    await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_ANALYSIS_RESULTS as Record<string, unknown>,
      0
    );
    await seedKeywordRatings(page, 'example.com', { 'keyword research': 4 });
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);
    await analysis.clickTab('All Keywords');

    const current = await rating.getCurrentRating('keyword research');
    expect(current).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Rating 0 — hidden keywords
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 2: Rating 0 hides keywords', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('rating a keyword 0 removes it from the visible keyword table', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    expect(await rating.isKeywordVisible('seo tools')).toBe(true);

    await rating.clickRating('seo tools', 0);

    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
  });

  test('hidden keyword count increments on the toggle when a keyword is rated 0', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);

    const count = await rating.getHiddenCount();
    expect(count).toBe(1);
  });

  test('hidden count increments for each additional keyword rated 0', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    await rating.clickRating('keyword research', 0);

    const count = await rating.getHiddenCount();
    expect(count).toBe(2);
  });

  test('show hidden keywords toggle reveals the hidden row', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);

    await rating.toggleShowHidden();

    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
  });

  test('hidden keywords render with distinct styling (strikethrough/greyed) when shown', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    await rating.toggleShowHidden();

    expect(await rating.isKeywordHiddenStyle('seo tools')).toBe(true);
  });

  test('toggle shows hidden keywords label with count N', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 0);

    await expect(rating.getHiddenKeywordsToggle()).toContainText('1');
  });

  test('re-rating a hidden keyword from the hidden view restores it to the visible table', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    await rating.toggleShowHidden();

    // Row is now visible but with hidden styling
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordHiddenStyle('seo tools')).toBe(true);

    // Re-rate to restore it
    await rating.clickRating('seo tools', 2);

    // After re-rating, hidden toggle is off and row is back in normal view
    await rating.toggleShowHidden(); // collapse hidden view
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordHiddenStyle('seo tools')).toBe(false);
  });

  test('rating 0 triggers the undo toast notification', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);

    await expect(rating.getUndoToast()).toBeVisible();
  });

  test('clicking Undo in the toast restores the keyword to the visible table', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);

    await expect(rating.getUndoToast()).toBeVisible();
    await rating.clickUndo();

    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
  });

  test('undo restores the hidden count to zero after undoing the only hidden keyword', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    await rating.clickRating('seo tools', 0);
    expect(await rating.getHiddenCount()).toBe(1);

    await rating.clickUndo();

    // Toggle should either disappear or show count 0
    const count = await rating.getHiddenCount();
    expect(count).toBe(0);
  });

  test('hidden keywords seeded in IDB are not shown by default on page load', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 0 });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
    expect(await rating.getHiddenCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 3: Persistence
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 3: Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('ratings survive a full page reload', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 4 });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    const current = await rating.getCurrentRating('seo tools');
    expect(current).toBe(4);

    await page.reload();
    await dashboard.waitForResults();

    const afterReload = await rating.getCurrentRating('seo tools');
    expect(afterReload).toBe(4);
  });

  test('ratings are domain-scoped — a rating for example.com does not appear for other.com', async ({ page }) => {
    // Seed a rating for example.com and also cache keywords for other.com
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 4 });
    // Seed same keywords for other.com (no ratings)
    await seedDomainCache(page, 'other.com', USER_KEYWORDS as any[]);

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // example.com shows the rating
    const rating = new KeywordRatingPage(page);
    expect(await rating.getCurrentRating('seo tools')).toBe(4);

    // Switch domain by re-analyzing other.com
    await dashboard.analyzeDomain('other.com');
    await dashboard.waitForResults();

    // other.com has no ratings — should show undefined
    const otherDomainRating = await rating.getCurrentRating('seo tools');
    expect(otherDomainRating).toBeUndefined();
  });

  test('ratings are preserved in IDB when switching domains and restored on switching back', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 4 });
    await seedDomainCache(page, 'other.com', [
      { keyword: 'seo tools', searchVolume: 5000, difficulty: 30, position: 8, etv: 200, cpc: 1.0 },
    ]);

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    // Confirm rating is present on example.com
    expect(await rating.getCurrentRating('seo tools')).toBe(4);

    // Switch to other.com
    await dashboard.analyzeDomain('other.com');
    await dashboard.waitForResults();
    expect(await rating.getCurrentRating('seo tools')).toBeUndefined();

    // Switch back to example.com
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();

    // Rating should be restored from IDB
    expect(await rating.getCurrentRating('seo tools')).toBe(4);
  });

  test('rating saved in IDB can be read back via readKeywordRatingsFromIdb after navigation', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 3);
    await rating.clickRating('keyword research', 1);

    const stored = await readKeywordRatingsFromIdb(page, 'example.com');
    expect(stored['seo tools']).toBe(3);
    expect(stored['keyword research']).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 4: Blog Topics stale banner
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 4: Blog Topics stale banner', () => {
  test('changing a rating in the opportunities tab shows the blog topics stale banner', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Open blog topics tab first so the component is initialised, then go back
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();

    await analysis.clickTab('Opportunities');

    // Rate a keyword to mark topics as stale
    await rating.clickRating('link building', 2);

    await expect(rating.getStaleBanner()).toBeVisible();
  });

  test('clicking Regenerate topics on the stale banner hides the banner', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();

    await analysis.clickTab('Opportunities');
    await rating.clickRating('link building', 2);

    await expect(rating.getStaleBanner()).toBeVisible();
    await rating.clickRegenerate();

    await expect(rating.getStaleBanner()).not.toBeVisible();
  });

  test('changing a rating from 1–4 to not relevant (0) shows the stale banner', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Visit blog topics tab to generate initial list, then return
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();
    await analysis.clickTab('Opportunities');

    // First rate the keyword as relevant (1–4) and then regenerate to clear stale
    await rating.clickRating('link building', 3);
    await analysis.clickTab('Blog Topics');
    await rating.clickRegenerate();
    await expect(rating.getStaleBanner()).not.toBeVisible();

    // Now change the same keyword to not relevant (0) — banner must reappear
    await analysis.clickTab('Opportunities');
    await rating.clickRating('link building', 0);
    await analysis.clickTab('Blog Topics');

    await expect(rating.getStaleBanner()).toBeVisible();
  });

  test('blog topics stale banner does not appear before any rating changes', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();

    await expect(rating.getStaleBanner()).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 5: Hint row (first-visit guidance)
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 5: Hint row on first visit', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('hint row is visible on first visit when no ratings have been set', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await expect(rating.getHintRow()).toBeVisible();
  });

  test('hint row disappears after the first rating action', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await expect(rating.getHintRow()).toBeVisible();

    await rating.clickRating('seo tools', 1);

    await expect(rating.getHintRow()).not.toBeVisible();
  });

  test('hint row does not reappear on page reload once dismissed by rating', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 1);
    await expect(rating.getHintRow()).not.toBeVisible();

    // Wait for the rating (and hint dismissal) IDB writes to commit before reloading,
    // otherwise the async writes may be aborted mid-flight by the navigation.
    const saved = await readKeywordRatingsFromIdb(page, 'example.com');
    expect(saved['seo tools']).toBe(1);

    await page.reload();
    await dashboard.waitForResults();

    await expect(rating.getHintRow()).not.toBeVisible();
  });

  test('hint row does not appear when ratings are already seeded in IDB', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 2 });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await expect(rating.getHintRow()).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Rule 6: Show hidden keywords and pagination
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 6: Show hidden keywords', () => {
  test.beforeEach(async ({ page }) => {
    await baseSetup(page);
  });

  test('toggle is not present when no keywords have been rated 0', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    const count = await rating.getHiddenCount();
    // If toggle is absent or count is 0, test passes
    expect(count).toBe(0);
  });

  test('toggle appears once at least one keyword is rated 0', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 0);

    await expect(rating.getHiddenKeywordsToggle()).toBeVisible();
  });

  test('clicking toggle a second time collapses the hidden keywords out of view again', async ({ page }) => {
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);
    await rating.clickRating('seo tools', 0);

    // First click reveals hidden keyword
    await rating.toggleShowHidden();
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);

    // Second click hides it again
    await rating.toggleShowHidden();
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);
  });

  test('pagination total count excludes keywords rated 0 (hidden)', async ({ page }) => {
    // Use 110-keyword cache so we can test pagination boundary
    const manyKeywords: Array<Record<string, unknown>> = Array.from({ length: 110 }, (_, i) => ({
      keyword: `keyword ${i + 1}`,
      searchVolume: 1000 + i * 10,
      difficulty: 30,
      position: i + 1,
      etv: 100,
      cpc: 1.0,
    }));

    // beforeEach already cleared IDB and seeded credentials/domain.
    // Override the domain cache with 110 keywords (overwrites beforeEach's USER_KEYWORDS seed).
    await seedDomainCache(page, 'example.com', manyKeywords);
    // Rate the first keyword as hidden before page loads
    await seedKeywordRatings(page, 'example.com', { 'keyword 1': 0 });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // With 110 keywords and 1 hidden: 109 visible
    // First page should show 100 rows (pagination page size)
    await expect(dashboard.keywordRows).toHaveCount(100);

    // Load more shows remaining: 109 - 100 = 9
    await expect(dashboard.loadMoreButton).toBeVisible();
    await expect(dashboard.loadMoreButton).toContainText('9 remaining');
  });

  test('hidden keywords seeded in IDB are shown with hidden styling when toggle is enabled', async ({ page }) => {
    await seedKeywordRatings(page, 'example.com', { 'seo tools': 0 });

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    const rating = new KeywordRatingPage(page);

    // Hidden by default
    expect(await rating.isKeywordVisible('seo tools')).toBe(false);

    await rating.toggleShowHidden();

    // Visible but with hidden styling
    expect(await rating.isKeywordVisible('seo tools')).toBe(true);
    expect(await rating.isKeywordHiddenStyle('seo tools')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 7: Regenerate blog topics excludes hidden keywords
// ---------------------------------------------------------------------------

test.describe('Keyword Rating — Rule 7: Regenerate excludes hidden keywords', () => {
  test('blog topics for a keyword seeded as hidden (rating 0) are absent on initial load', async ({ page }) => {
    await setupWithCompetitorCache(page);
    // 'link building' is one of the two opportunities in the cached results
    await seedKeywordRatings(page, 'example.com', { 'link building': 0 });

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();

    // No topic card should reference the hidden keyword
    const linkBuildingTopics = analysis.topicCards.filter({ hasText: /link building/i });
    await expect(linkBuildingTopics).toHaveCount(0);

    // Topics for the other opportunity keyword should still be present
    const backLinkTopics = analysis.topicCards.filter({ hasText: /backlink checker/i });
    await expect(backLinkTopics).not.toHaveCount(0);
  });

  test('clicking Regenerate removes blog topics for a keyword rated 0 since the last generation', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Confirm both opportunity keywords produce topics on initial load
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();
    const initialLinkBuildingTopics = analysis.topicCards.filter({ hasText: /link building/i });
    await expect(initialLinkBuildingTopics).not.toHaveCount(0);

    // Hide 'link building' from the Opportunities tab
    await analysis.clickTab('Opportunities');
    await rating.clickRating('link building', 0);

    // Switch to Blog Topics — stale banner should appear
    await analysis.clickTab('Blog Topics');
    await expect(rating.getStaleBanner()).toBeVisible();

    // Regenerate
    await rating.clickRegenerate();

    // Banner dismissed
    await expect(rating.getStaleBanner()).not.toBeVisible();

    // Topics for 'link building' are gone
    const afterLinkBuildingTopics = analysis.topicCards.filter({ hasText: /link building/i });
    await expect(afterLinkBuildingTopics).toHaveCount(0);

    // Topics for the remaining opportunity are still present
    const backLinkTopics = analysis.topicCards.filter({ hasText: /backlink checker/i });
    await expect(backLinkTopics).not.toHaveCount(0);
  });

  test('topic count on the stat card decreases after regenerating with a hidden keyword', async ({ page }) => {
    await setupWithCompetitorCache(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);
    const rating = new KeywordRatingPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Record initial topic count
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();
    const initialCount = await analysis.blogTopicsContainer.locator('.topic-card').count();
    expect(initialCount).toBeGreaterThan(0);

    // Hide one opportunity keyword
    await analysis.clickTab('Opportunities');
    await rating.clickRating('link building', 0);

    await analysis.clickTab('Blog Topics');
    await rating.clickRegenerate();

    // Count should be strictly less after removing one keyword's topics
    const afterCount = await analysis.blogTopicsContainer.locator('.topic-card').count();
    expect(afterCount).toBeLessThan(initialCount);
  });
});
