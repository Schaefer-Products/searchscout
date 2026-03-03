import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials } from '../support/idb-helpers';
import { stubDomainKeywords, stubCompetitorDiscovery } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';
import { CompetitorSelectionPage } from '../pages/competitor-selection.page';

test.describe('Competitor Discovery', () => {
  let dashboard: DashboardPage;
  let competitorSel: CompetitorSelectionPage;

  test.beforeEach(async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await stubDomainKeywords(page, 'example');
    await stubCompetitorDiscovery(page);

    await page.goto('/dashboard');

    dashboard = new DashboardPage(page);
    competitorSel = new CompetitorSelectionPage(page);

    // Analyze domain then open competitor selection
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();
    await dashboard.discoverCompetitorsButton.click();

    // Trigger discovery
    await competitorSel.discover();
  });

  test('discover returns 3 competitor cards from the fixture', async () => {
    await expect(competitorSel.competitorCards).toHaveCount(3);
  });

  test('top 3 competitors are auto-selected after discovery', async () => {
    // All 3 fixtures competitors should be auto-selected (slice(0, 5) covers all 3)
    await expect(competitorSel.selectedCards).toHaveCount(3);
  });

  test('toggling a card deselects and then reselects it', async () => {
    // First competitor is selected → click to deselect
    await competitorSel.toggleCompetitor(0);
    await expect(competitorSel.selectedCards).toHaveCount(2);

    // Click again to reselect
    await competitorSel.toggleCompetitor(0);
    await expect(competitorSel.selectedCards).toHaveCount(3);
  });

  test('confirming selection shows selected-competitors-section in dashboard', async ({ page }) => {
    await competitorSel.confirm();

    await expect(dashboard.selectedCompetitorsSection).toBeVisible();
    await expect(dashboard.selectedChips).toHaveCount(3);
  });
});
