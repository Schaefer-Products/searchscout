import { test, expect, Page } from '@playwright/test';
import {
  clearIndexedDb,
  seedCredentials,
  seedCurrentDomain,
  seedSelectedCompetitors,
  seedDomainCache,
  seedCompetitorAnalysisCache,
} from '../support/idb-helpers';
import { stubCompetitorKeywords } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';
import { CompetitorAnalysisPage } from '../pages/competitor-analysis.page';

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const INFO_BTN = '.info-icon-btn';
const TOOLTIP = '.info-tooltip';
const TOOLTIP_VISIBLE = '.info-tooltip.visible';

// ---------------------------------------------------------------------------
// Shared fixtures (mirrors 08-keyword-rating.spec.ts for consistency)
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

const COMPETITOR_DOMAINS = ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'];

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
  analyzedCompetitors: COMPETITOR_DOMAINS,
  timestamp: Date.now(),
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

async function seedBase(page: Page): Promise<void> {
  await clearIndexedDb(page);
  await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
  await seedCurrentDomain(page, 'example.com');
  await seedDomainCache(page, 'example.com', USER_KEYWORDS as any[]);
}

async function seedWithAnalysis(page: Page): Promise<void> {
  await seedBase(page);
  await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
  await seedCompetitorAnalysisCache(
    page,
    'example.com',
    COMPETITOR_DOMAINS,
    CACHED_ANALYSIS_RESULTS as Record<string, unknown>,
    0
  );
  await stubCompetitorKeywords(page, 'standard');
}

async function loadAnalysisPage(
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
// Suite 1: Info icon visibility
// ---------------------------------------------------------------------------

test.describe('Opportunity Score Tooltip — visibility', () => {
  test('info icon button is visible in the Opportunity Score column header when analysis is complete', async ({ page }) => {
    await seedWithAnalysis(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    // Default tab after analysis is Opportunities — info icon must be present
    await expect(page.locator(INFO_BTN)).toBeVisible();
  });

  test('info icon is not visible before competitor analysis has started', async ({ page }) => {
    await seedBase(page);

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForResults();

    // No competitor analysis component rendered yet — info button must be absent
    await expect(page.locator(INFO_BTN)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Open / close behaviour
// ---------------------------------------------------------------------------

test.describe('Opportunity Score Tooltip — open and close', () => {
  test.beforeEach(async ({ page }) => {
    await seedWithAnalysis(page);
  });

  test('clicking the info icon opens the tooltip', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    // Tooltip must exist in DOM but start hidden
    await expect(page.locator(TOOLTIP)).toBeAttached();
    await expect(page.locator(TOOLTIP_VISIBLE)).toHaveCount(0);

    await page.locator(INFO_BTN).click();

    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();
  });

  test('clicking the info icon a second time closes the tooltip', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toHaveCount(0);
  });

  test('pressing Escape closes the tooltip', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator(TOOLTIP_VISIBLE)).toHaveCount(0);
  });

  test('clicking outside the tooltip closes it', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    // Click an area well outside the tooltip — the page heading is safe
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    await expect(page.locator(TOOLTIP_VISIBLE)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Tooltip content
// ---------------------------------------------------------------------------

test.describe('Opportunity Score Tooltip — content', () => {
  test('tooltip title reads "Opportunity Score"', async ({ page }) => {
    await seedWithAnalysis(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await expect(page.locator(`${TOOLTIP_VISIBLE} .info-tooltip__title`)).toHaveText('Opportunity Score');
  });

  test('tooltip body mentions Search Volume', async ({ page }) => {
    await seedWithAnalysis(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await expect(page.locator(TOOLTIP_VISIBLE)).toContainText(/search volume/i);
  });

  test('tooltip body mentions keyword difficulty', async ({ page }) => {
    await seedWithAnalysis(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await expect(page.locator(TOOLTIP_VISIBLE)).toContainText(/difficulty/i);
  });

  test('tooltip body mentions competitor validation', async ({ page }) => {
    await seedWithAnalysis(page);

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    await page.locator(INFO_BTN).click();
    await expect(page.locator(TOOLTIP_VISIBLE)).toBeVisible();

    await expect(page.locator(TOOLTIP_VISIBLE)).toContainText(/competitor/i);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Info icon absent on non-opportunities tabs
// ---------------------------------------------------------------------------

test.describe('Opportunity Score Tooltip — hidden on non-opportunities tabs', () => {
  test.beforeEach(async ({ page }) => {
    await seedWithAnalysis(page);
  });

  test('info icon is not visible on the All Keywords tab', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);
    await analysis.clickTab('All Keywords');

    // The <th> with the Opportunity Score column is removed in this view —
    // the info button must therefore not exist in the DOM at all.
    await expect(page.locator(INFO_BTN)).toHaveCount(0);
  });

  test('info icon is not visible on the Shared tab', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);
    await analysis.clickTab('Shared');

    await expect(page.locator(INFO_BTN)).toHaveCount(0);
  });

  test('info icon is not visible on the Your Unique tab', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);
    await analysis.clickTab('Your Unique');

    await expect(page.locator(INFO_BTN)).toHaveCount(0);
  });

  test('info icon is not visible on the Blog Topics tab', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);
    await analysis.clickTab('Blog Topics');

    await expect(page.locator(INFO_BTN)).toHaveCount(0);
  });

  test('info icon reappears when switching back to the Opportunities tab', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await loadAnalysisPage(page, dashboard, analysis);

    // Leave Opportunities tab
    await analysis.clickTab('All Keywords');
    await expect(page.locator(INFO_BTN)).toHaveCount(0);

    // Return to Opportunities tab
    await analysis.clickTab('Opportunities');
    await expect(page.locator(INFO_BTN)).toBeVisible();
  });
});
