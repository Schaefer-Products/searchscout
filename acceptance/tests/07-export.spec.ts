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
// Shared fixtures (mirrors 06-competitor-analysis.spec.ts setup)
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

// ---------------------------------------------------------------------------
// Download interception helpers
//
// Patches document.createElement('a') so that any blob-URL download is
// captured synchronously (via a sync XHR) into window.__capturedDownloads
// before URL.revokeObjectURL() can invalidate the URL.  This avoids relying
// on Playwright's download event and gives us the full CSV content to assert.
// ---------------------------------------------------------------------------

async function interceptDownloads(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__capturedDownloads = [];
    const originalCreateElement = document.createElement.bind(document);
    (document as any).createElement = function (tagName: string) {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() !== 'a') return el;
      const originalClick = el.click.bind(el);
      Object.defineProperty(el, 'click', {
        configurable: true,
        value: function () {
          const anchor = el as HTMLAnchorElement;
          if (anchor.download && anchor.href.startsWith('blob:')) {
            // Read synchronously before revokeObjectURL() is called
            const xhr = new XMLHttpRequest();
            xhr.open('GET', anchor.href, false /* synchronous */);
            xhr.send();
            (window as any).__capturedDownloads.push({
              name: anchor.download,
              content: xhr.responseText,
            });
            // Do NOT call originalClick() — prevents actual file download
          } else {
            originalClick();
          }
        },
      });
      return el;
    };
  });
}

async function getLastDownload(page: Page): Promise<{ name: string; content: string }> {
  const downloads = await page.evaluate(
    () => (window as any).__capturedDownloads as Array<{ name: string; content: string }>
  );
  const last = downloads[downloads.length - 1];
  if (!last) throw new Error('No download was captured');
  return last;
}

// ---------------------------------------------------------------------------
// Shared setup helpers
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
// Tests
// ---------------------------------------------------------------------------

test.describe('Export Analysis Results to CSV', () => {
  // -------------------------------------------------------------------------
  // Scenario: Export button label reflects the active tab
  // -------------------------------------------------------------------------

  test('export button label reflects the active view tab', async ({ page }) => {
    await standardSetup(page);
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Opportunities tab (default) → "Export Opportunities"
    await expect(analysis.exportButton).toContainText('Export Opportunities');

    // Blog Topics tab → "Export Blog Topics"
    await analysis.clickTab('Blog Topics');
    await expect(analysis.exportButton).toContainText('Export Blog Topics');

    // Shared tab → "Export All Keywords"
    await analysis.clickTab('Shared');
    await expect(analysis.exportButton).toContainText('Export All Keywords');

    // Your Unique tab → "Export All Keywords"
    await analysis.clickTab('Your Unique');
    await expect(analysis.exportButton).toContainText('Export All Keywords');

    // All Keywords tab → "Export All Keywords"
    await analysis.clickTab('All Keywords');
    await expect(analysis.exportButton).toContainText('Export All Keywords');
  });

  // -------------------------------------------------------------------------
  // Scenario: Exporting keyword opportunities
  // -------------------------------------------------------------------------

  test('exporting opportunities produces a CSV with correct filename, metadata header, and data columns', async ({ page }) => {
    await standardSetup(page);
    await interceptDownloads(page);
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Opportunities tab is active by default
    await expect(analysis.opportunitiesTab).toHaveClass(/active/);
    await analysis.exportButton.click();

    const today = new Date().toISOString().split('T')[0];
    const { name, content } = await getLastDownload(page);

    // Filename: opportunities_example-com_<today>.csv
    expect(name).toBe(`opportunities_example-com_${today}.csv`);

    // Metadata header
    expect(content).toContain('SearchScout - Keyword Opportunities Report');
    expect(content).toContain('Domain: example.com');
    expect(content).toContain('competitor-a.com');
    expect(content).toContain('competitor-b.com');
    expect(content).toContain('competitor-c.com');
    expect(content).toContain('Total Opportunities: 2');

    // Column headers
    expect(content).toContain(
      'Keyword,Search Volume,Difficulty,Opportunity Score,Competitor Count,Competitors,CPC (USD)'
    );

    // Data rows contain the 2 opportunity keywords
    expect(content).toContain('link building');
    expect(content).toContain('backlink checker');
  });

  // -------------------------------------------------------------------------
  // Scenario: Exporting blog topic recommendations
  // -------------------------------------------------------------------------

  test('exporting blog topics produces a CSV with correct filename, metadata header, and data columns', async ({ page }) => {
    await standardSetup(page);
    await interceptDownloads(page);
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    await analysis.clickTab('Blog Topics');
    await expect(analysis.blogTopicsContainer).toBeVisible();
    await analysis.exportButton.click();

    const today = new Date().toISOString().split('T')[0];
    const { name, content } = await getLastDownload(page);

    // Filename: blog-topics_example-com_<today>.csv
    expect(name).toBe(`blog-topics_example-com_${today}.csv`);

    // Metadata header for blog topics report
    expect(content).toContain('Blog Topic Recommendations Report');
    expect(content).toContain('Domain: example.com');

    // Column headers
    expect(content).toContain(
      'Rank,Title,Keyword,Category,Recommendation Score,Search Volume,Difficulty,Competitor Count'
    );

    // Data rows: 2 topics (one per opportunity keyword)
    const dataLines = content.split('\n').filter(l => l.trim() && !l.startsWith('SearchScout') && !l.startsWith('Domain') && !l.startsWith('Competitors') && !l.startsWith('Generated') && !l.startsWith('Total') && !l.startsWith('Rank'));
    expect(dataLines.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Scenario: Exporting all keywords
  // -------------------------------------------------------------------------

  test('exporting all keywords produces a CSV with Type column and every keyword from the analysis', async ({ page }) => {
    await standardSetup(page);
    await interceptDownloads(page);
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    await analysis.clickTab('All Keywords');
    await analysis.exportButton.click();

    const today = new Date().toISOString().split('T')[0];
    const { name, content } = await getLastDownload(page);

    // Filename: all-keywords_example-com_<today>.csv
    expect(name).toBe(`all-keywords_example-com_${today}.csv`);

    // Type column present in headers
    expect(content).toContain('Type');

    // All keyword type values are present
    expect(content).toContain('Opportunity');
    expect(content).toContain('Shared');
    expect(content).toContain('Your Unique');

    // Every keyword from the analysis is present
    expect(content).toContain('link building');
    expect(content).toContain('backlink checker');
    expect(content).toContain('seo tools');
    expect(content).toContain('keyword research');
  });

  // -------------------------------------------------------------------------
  // Scenario: Keywords with special characters are exported correctly
  // -------------------------------------------------------------------------

  test('commas and quotation marks in keyword values are properly escaped in the exported CSV', async ({ page }) => {
    // Seed a competitor analysis cache with special-character opportunity keywords
    const CACHED_RESULTS_SPECIAL = {
      allKeywords: [
        {
          keyword: 'link building, strategies',  // comma → must be quoted in CSV
          searchVolume: 9000,
          difficulty: 55,
          competitorCount: 2,
          isOpportunity: true,
          competitorRankings: [
            { domain: 'competitor-a.com', position: 3 },
            { domain: 'competitor-b.com', position: 5 },
          ],
          opportunityScore: 34,
          cpc: 3.20,
        },
        {
          keyword: '"seo" tools guide',  // double-quotes → must be escaped as ""
          searchVolume: 5000,
          difficulty: 40,
          competitorCount: 1,
          isOpportunity: true,
          competitorRankings: [{ domain: 'competitor-c.com', position: 4 }],
          opportunityScore: 28,
          cpc: 2.50,
        },
      ],
      opportunities: [
        {
          keyword: 'link building, strategies',
          searchVolume: 9000,
          difficulty: 55,
          competitorCount: 2,
          isOpportunity: true,
          competitorRankings: [
            { domain: 'competitor-a.com', position: 3 },
            { domain: 'competitor-b.com', position: 5 },
          ],
          opportunityScore: 34,
          cpc: 3.20,
        },
        {
          keyword: '"seo" tools guide',
          searchVolume: 5000,
          difficulty: 40,
          competitorCount: 1,
          isOpportunity: true,
          competitorRankings: [{ domain: 'competitor-c.com', position: 4 }],
          opportunityScore: 28,
          cpc: 2.50,
        },
      ],
      shared: [],
      uniqueToUser: [],
      totalKeywords: 2,
      analyzedCompetitors: ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      timestamp: Date.now(),
    };

    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    await seedSelectedCompetitors(page, 'example.com', COMPETITORS);
    await seedDomainCache(page, 'example.com', USER_KEYWORDS as any[]);
    await seedCompetitorAnalysisCache(
      page,
      'example.com',
      ['competitor-a.com', 'competitor-b.com', 'competitor-c.com'],
      CACHED_RESULTS_SPECIAL as Record<string, unknown>,
      0
    );
    await interceptDownloads(page);
    // Stub is needed for the domain auto-analysis (loads from domain cache) but
    // not for competitor analysis (loads from competitor cache).
    await stubCompetitorKeywords(page, 'standard');

    const dashboard = new DashboardPage(page);
    const analysis = new CompetitorAnalysisPage(page);

    await navigateAndStartAnalysis(page, dashboard, analysis);

    // Export opportunities (both keywords have special chars)
    await expect(analysis.opportunitiesTab).toHaveClass(/active/);
    await analysis.exportButton.click();

    const { content } = await getLastDownload(page);

    // Keyword with comma is wrapped in double-quotes
    expect(content).toContain('"link building, strategies"');

    // Keyword with double-quotes: internal quotes doubled, then wrapped
    // '"seo" tools guide' → """seo"" tools guide"
    expect(content).toContain('"""seo"" tools guide"');
  });
});
