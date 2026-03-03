import { test, expect, Page } from '@playwright/test';
import {
  clearIndexedDb,
  seedCredentials,
  seedCurrentDomain,
  seedSelectedCompetitors,
  seedDomainCache,
  seedCompetitorAnalysisCache,
} from '../support/idb-helpers';
import { stubCompetitorKeywords, stubCompetitorDiscovery } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';
import { CompetitorAnalysisPage } from '../pages/competitor-analysis.page';
import { CompetitorSelectionPage } from '../pages/competitor-selection.page';

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

const CACHED_RESULTS = {
  allKeywords: [
    {
      keyword: 'cached keyword',
      searchVolume: 5000,
      difficulty: 40,
      competitorCount: 2,
      isOpportunity: true,
      competitorRankings: [],
      opportunityScore: 28,
    },
  ],
  opportunities: [
    {
      keyword: 'cached keyword',
      searchVolume: 5000,
      difficulty: 40,
      competitorCount: 2,
      isOpportunity: true,
      competitorRankings: [],
      opportunityScore: 28,
    },
  ],
  shared: [],
  uniqueToUser: [],
  totalKeywords: 1,
  analyzedCompetitors: ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
  timestamp: Date.now(),
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function standardSetup(page: Page): Promise<void> {
  await clearIndexedDb(page);
  await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  await seedCurrentDomain(page, 'example.com');
  await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
  await seedDomainCache(page, 'example.com', USER_KEYWORDS as any[]);
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
// Rule 1: Analysing and viewing results
// ---------------------------------------------------------------------------

test.describe('Competitor Analysis — Rule 1: Analysing and viewing results', () => {
  let dashboard: DashboardPage;
  let analysis: CompetitorAnalysisPage;

  test('running analysis shows correct counts for opportunities, shared, unique and total', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    await expect(analysis.opportunitiesCount).toHaveText('2');
    await expect(analysis.sharedCount).toHaveText('1');
    await expect(analysis.uniqueCount).toHaveText('1');
    await expect(analysis.totalCount).toHaveText('4');

    // After a live fetch, cache.save() runs before getCacheMetadata(), so
    // cacheMetadata is always non-null — the "Data from cache" badge is shown.
    await expect(analysis.cacheDataBadge).toBeVisible();
  });

  test('opportunities tab is active by default and shows keywords sorted by score descending', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Opportunities tab is active by default
    await expect(analysis.opportunitiesTab).toHaveClass(/active/);

    // Two opportunity keywords (user doesn't rank for link building or backlink checker)
    await expect(analysis.keywordRows).toHaveCount(2);

    // Volume, Difficulty, Opportunity Score columns visible; Your Position column hidden
    await expect(analysis.volumeHeader).toBeVisible();
    await expect(analysis.opportunityScoreHeader).toBeVisible();
    await expect(analysis.positionHeader).not.toBeVisible();

    // Sorted desc by opportunity score: link building (34) before backlink checker (31)
    const scores = await analysis.getOpportunityScores();
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[0]).toBe(34);
    expect(scores[1]).toBe(31);

    // All 3 competitors returned "link building" so first row shows badge '3'
    const firstCompetitorBadge = analysis.keywordRows.first().locator('.competitor-badge');
    await expect(firstCompetitorBadge).toHaveText('3');
  });

  test('switching tabs shows the correct keyword subset for each view', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // --- Shared tab ---
    await analysis.clickTab('Shared');
    await expect(analysis.keywordRows).toHaveCount(1);
    await expect(analysis.firstKeywordText).toHaveText('seo tools');
    await expect(analysis.positionHeader).toBeVisible();

    // --- Your Unique tab ---
    await analysis.clickTab('Your Unique');
    await expect(analysis.keywordRows).toHaveCount(1);
    await expect(analysis.firstKeywordText).toHaveText('keyword research');
    const positionBadge = analysis.keywordRows.first().locator('.position-badge');
    await expect(positionBadge).toHaveText('#2');

    // --- All Keywords tab ---
    await analysis.clickTab('All Keywords');
    await expect(analysis.keywordRows).toHaveCount(4);

    // --- Opportunities tab ---
    await analysis.clickTab('Opportunities');
    await expect(analysis.keywordRows).toHaveCount(2);
    await expect(analysis.opportunityScoreHeader).toBeVisible();
    await expect(analysis.positionHeader).not.toBeVisible();
  });

  test('clicking a sort column header sorts descending first, then ascending on second click', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // First click on Difficulty: new column → sorts descending (60 first)
    // Use a retrying expect on the first row before reading all values,
    // to ensure Angular has re-rendered before allTextContents() is called.
    await analysis.difficultyHeader.click();
    await expect(analysis.keywordRows.first().locator('.difficulty-value')).toHaveText('60');
    let difficulties = await analysis.getDifficultyValues();
    expect(difficulties[0]).toBe(60); // backlink checker
    expect(difficulties[1]).toBe(55); // link building

    // Second click on Difficulty: same column → toggles to ascending (55 first)
    await analysis.difficultyHeader.click();
    await expect(analysis.keywordRows.first().locator('.difficulty-value')).toHaveText('55');
    difficulties = await analysis.getDifficultyValues();
    expect(difficulties[0]).toBe(55); // link building
    expect(difficulties[1]).toBe(60); // backlink checker
  });

  test('load more button appends keywords when more than 50 exist', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
    // Empty user keywords: all competitor keywords become opportunities
    await seedDomainCache(page, 'example.com', []);
    await stubCompetitorKeywords(page, 'many');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    // With empty user keywords the domain analysis returns an empty state,
    // but the keywords array is populated (0 length). We need to handle that
    // the dashboard waitForResults waits for keyword rows, which won't appear
    // when keywords=[]. We'll navigate directly and click start analysis
    // after the domain auto-analysis completes (it will find 0 keywords
    // and show an empty state, but hasAnalyzed becomes true).
    await page.goto('/dashboard');

    // Wait for the analysis to complete (empty keywords shows empty state OR
    // the selected-competitors-section appears after auto-analyze).
    await dashboard.selectedCompetitorsSection.waitFor({ state: 'visible', timeout: 15000 });
    await dashboard.startAnalysisButton.click();
    await analysis.waitForAnalysisComplete();

    // First page: 50 keywords
    await expect(analysis.keywordRows).toHaveCount(50);

    // Load more button shows 5 remaining (55 - 50 = 5)
    await expect(analysis.loadMoreButton).toBeVisible();
    await expect(analysis.loadMoreButton).toContainText('5 remaining');

    // Click load more
    await analysis.loadMoreButton.click();

    // Now all 55 shown
    await expect(analysis.keywordRows).toHaveCount(55);

    // Load more button gone
    await expect(analysis.loadMoreButton).not.toBeVisible();
  });

  test('blog topics tab shows generated title cards sorted by recommendation score', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Blog topics tab is visible (opportunities exist)
    await expect(analysis.blogTopicsTab).toBeVisible();

    // Click blog topics tab
    await analysis.clickTab('Blog Topics');

    // Blog topics container is visible
    await expect(analysis.blogTopicsContainer).toBeVisible();

    // One card per opportunity keyword (2 opportunities: link building, backlink checker)
    await expect(analysis.topicCards).toHaveCount(2);

    // First card has a non-empty title
    const firstCard = analysis.topicCards.first();
    const titleText = await firstCard.locator('.topic-title').textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);

    // First card's keyword is one of the opportunity keywords
    const keywordText = await firstCard.locator('.meta-item.keyword').textContent();
    expect(['link building', 'backlink checker']).toContain(keywordText?.trim());

    // First card's category is non-empty
    const categoryText = await firstCard.locator('.meta-item.category').textContent();
    expect(categoryText?.trim().length).toBeGreaterThan(0);

    // Volume stat is visible and non-empty on the card
    const volumeStatValue = firstCard.locator('.topic-stats .stat').filter({ hasText: 'Volume' }).locator('.stat-value');
    await expect(volumeStatValue).toBeVisible();
    const volumeText = await volumeStatValue.textContent();
    expect(volumeText?.trim().length).toBeGreaterThan(0);

    // Difficulty stat is visible and numeric on the card
    const difficultyStatValue = firstCard.locator('.topic-stats .stat').filter({ hasText: 'Difficulty' }).locator('.stat-value');
    await expect(difficultyStatValue).toBeVisible();
    const difficultyText = await difficultyStatValue.textContent();
    expect(isNaN(parseInt(difficultyText?.trim() ?? '', 10))).toBe(false);

    // Competitors stat = '3' (all 3 competitors ranked for these keywords)
    const competitorStatValue = firstCard.locator('.topic-stats .stat').filter({ hasText: 'Competitors' }).locator('.stat-value');
    await expect(competitorStatValue).toHaveText('3');

    // Sorted by recommendation score descending: first score >= second score
    const scoreTexts = await analysis.topicCards.locator('.score-value').allTextContents();
    const scores = scoreTexts.map(t => parseInt(t.trim(), 10));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
  });
});

// ---------------------------------------------------------------------------
// Rule 2: Cache and data freshness
// ---------------------------------------------------------------------------

test.describe('Competitor Analysis — Rule 2: Cache and data freshness', () => {
  let dashboard: DashboardPage;
  let analysis: CompetitorAnalysisPage;

  test('loading from cache shows the cache badge with age and refresh fetches fresh data', async ({ page }) => {
    await standardSetup(page);
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_RESULTS as Record<string, unknown>,
      2
    );
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Loaded from cache — badge shows "Data from cache (2 days old)"
    await expect(analysis.cacheDataBadge).toBeVisible();
    await expect(analysis.cacheDataBadge).toContainText('2 days');

    // Cached results: only 1 keyword
    await expect(analysis.keywordRows).toHaveCount(1);
    await expect(analysis.keywordRows.first().locator('.keyword-text')).toHaveText('cached keyword');

    // Click refresh
    await analysis.refreshButton.click();
    await analysis.waitForAnalysisComplete();

    // After fresh fetch, cache.save() means cacheMetadata is non-null (0 days old)
    await expect(analysis.cacheDataBadge).toBeVisible();
    await expect(analysis.cacheDataBadge).toContainText('0 days');

    // Now shows live data: 2 opportunity keywords (link building + backlink checker)
    await expect(analysis.keywordRows).toHaveCount(2);
  });

  test('changing competitor selection destroys and recreates the analysis component', async ({ page }) => {
    await standardSetup(page);
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_RESULTS as Record<string, unknown>,
      1
    );
    // Stub competitor discovery for when user clicks "Change Selection"
    // (CompetitorSelectionComponent auto-discovers when preSelectedCompetitors exist)
    await stubCompetitorDiscovery(page);
    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);
    const competitorSel = new CompetitorSelectionPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Initial results from cache: 1 row
    await expect(analysis.keywordRows).toHaveCount(1);

    // Click "Change Selection"
    await dashboard.changeSelectionButton.click();

    // Competitor selection component is now visible
    await expect(competitorSel.competitorCards.first()).toBeVisible();

    // Find and deselect competitor-c.com
    const cards = competitorSel.competitorCards;
    const cardCount = await cards.count();
    let competitorCCard = null;
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const text = await card.textContent();
      if (text?.includes('competitor-c.com')) {
        competitorCCard = card;
        break;
      }
    }
    expect(competitorCCard).not.toBeNull();

    // Card should currently be selected (loaded from IDB)
    await expect(competitorCCard!).toHaveClass(/selected/);

    // Click to deselect
    await competitorCCard!.click();
    await expect(competitorCCard!).not.toHaveClass(/selected/);

    // Confirm the new selection (a + b only)
    await competitorSel.confirm();

    // Wait for fresh analysis with the a/b competitor set (different cache key, no cache)
    await analysis.waitForAnalysisComplete();

    // Fresh analysis for a/b shows 2 opportunity keywords from the stub
    await expect(analysis.keywordRows).toHaveCount(2);

    // Fresh data was saved to cache (0 days old)
    await expect(analysis.cacheDataBadge).toContainText('0 days');

    // Blog topics regenerate based on the new opportunities
    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();
    await expect(analysis.topicCards.first()).toBeVisible();
  });

  test('a different competitor set does not reuse the previous analysis cache', async ({ page }) => {
    const CACHED_RESULTS_AB = {
      allKeywords: [
        {
          keyword: 'cached keyword',
          searchVolume: 5000,
          difficulty: 40,
          competitorCount: 2,
          isOpportunity: true,
          competitorRankings: [],
          opportunityScore: 28,
        },
      ],
      opportunities: [
        {
          keyword: 'cached keyword',
          searchVolume: 5000,
          difficulty: 40,
          competitorCount: 2,
          isOpportunity: true,
          competitorRankings: [],
          opportunityScore: 28,
        },
      ],
      shared: [],
      uniqueToUser: [],
      totalKeywords: 1,
      analyzedCompetitors: ['competitor-a.com', 'competitor-b.com'],
      timestamp: Date.now(),
    };

    const COMPETITORS_AB = [
      { domain: 'competitor-a.com', keywordOverlap: 850, totalKeywords: 2100, isManual: false },
      { domain: 'competitor-b.com', keywordOverlap: 620, totalKeywords: 1800, isManual: false },
    ];

    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    // Only seed a/b as selected competitors
    await seedSelectedCompetitors(page, 'example.com', COMPETITORS_AB);
    await seedDomainCache(page, 'example.com', USER_KEYWORDS as any[]);

    // Seed the a/b cache (should be used)
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com'],
      CACHED_RESULTS_AB as Record<string, unknown>,
      3
    );
    // Also seed a/b/c cache (should NOT be used for this run)
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_RESULTS as Record<string, unknown>,
      5
    );

    await stubCompetitorKeywords(page, 'standard');

    dashboard = new DashboardPage(page);
    analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Should load from the a/b cache (3 days old), NOT the a/b/c cache
    await expect(analysis.cacheDataBadge).toBeVisible();
    await expect(analysis.cacheDataBadge).toContainText('3 days');

    // From CACHED_RESULTS_AB: 1 keyword row
    await expect(analysis.keywordRows).toHaveCount(1);
    await expect(analysis.keywordRows.first().locator('.keyword-text')).toHaveText('cached keyword');
  });
});
