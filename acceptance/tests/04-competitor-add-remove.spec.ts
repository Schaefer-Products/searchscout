import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials } from '../support/idb-helpers';
import { stubDomainKeywords, stubCompetitorDiscovery } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';
import { CompetitorSelectionPage } from '../pages/competitor-selection.page';

test.describe('Competitor Manual Add/Remove', () => {
  let competitorSel: CompetitorSelectionPage;

  test.beforeEach(async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await stubDomainKeywords(page, 'example');
    await stubCompetitorDiscovery(page);

    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    competitorSel = new CompetitorSelectionPage(page);

    // Navigate to competitor selection with discovered competitors
    await dashboard.analyzeDomain('example.com');
    await dashboard.waitForResults();
    await dashboard.discoverCompetitorsButton.click();
    await competitorSel.discover();
  });

  test('valid manual domain is added with Manual badge and auto-selected', async () => {
    const initialCount = await competitorSel.competitorCards.count();

    await competitorSel.addManualCompetitor('manual-competitor.com');

    await expect(competitorSel.competitorCards).toHaveCount(initialCount + 1);
    await expect(competitorSel.manualBadges).toHaveCount(1);

    // The newly added card should be selected
    const newCard = competitorSel.competitorCards.last();
    await expect(newCard).toHaveClass(/selected/);
  });

  test('invalid domain shows .manual-error', async () => {
    await competitorSel.addManualCompetitor('not a valid domain!!!');

    await expect(competitorSel.manualError).toBeVisible();
    // No new card added
    await expect(competitorSel.competitorCards).toHaveCount(3);
  });

  test('duplicate domain shows .manual-error', async () => {
    // Add a manual competitor first
    await competitorSel.addManualCompetitor('manual-competitor.com');
    await expect(competitorSel.competitorCards).toHaveCount(4);

    // Attempt to add the same domain again
    await competitorSel.addManualCompetitor('manual-competitor.com');

    await expect(competitorSel.manualError).toBeVisible();
    await expect(competitorSel.competitorCards).toHaveCount(4);
  });

  test('remove button deletes the manual competitor card', async () => {
    // Add a manual competitor
    await competitorSel.addManualCompetitor('to-remove.com');
    await expect(competitorSel.competitorCards).toHaveCount(4);

    // Remove the manual competitor
    await competitorSel.removeButtons.first().click();

    await expect(competitorSel.competitorCards).toHaveCount(3);
    await expect(competitorSel.manualBadges).toHaveCount(0);
  });
});
