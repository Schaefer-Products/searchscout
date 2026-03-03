import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials, seedCurrentDomain, seedSelectedCompetitors } from '../support/idb-helpers';
import { stubDomainKeywords } from '../support/api-stubs';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('Persistence and Guards', () => {
  test('no credentials — /dashboard redirects to /setup', async ({ page }) => {
    await clearIndexedDb(page);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/setup/);
  });

  test('credentials survive a full page reload', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/);

    // Reload — APP_INITIALIZER re-reads IDB, credentials still present
    await page.reload();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('domain is pre-filled from IDB on load', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);
    await expect(dashboard.domainInput).toHaveValue('example.com');
  });

  test('selected competitors are visible after analysis when seeded in IDB', async ({ page }) => {
    const competitors = [
      { domain: 'competitor-a.com', keywordOverlap: 850, totalKeywords: 2100, isManual: false },
      { domain: 'competitor-b.com', keywordOverlap: 620, totalKeywords: 1800, isManual: false },
    ];

    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'test@example.com', password: 'testpass' });
    await seedCurrentDomain(page, 'example.com');
    await seedSelectedCompetitors(page, 'example.com', competitors);
    await stubDomainKeywords(page, 'example');
    await page.goto('/dashboard');

    const dashboard = new DashboardPage(page);

    // Domain pre-filled and competitors loaded from IDB — analyze to set hasAnalyzed = true
    await expect(dashboard.domainInput).toHaveValue('example.com');
    await dashboard.analyzeButton.click();
    await dashboard.waitForResults();

    // selected-competitors-section shows because selectedCompetitors.length > 0 && hasAnalyzed
    await expect(dashboard.selectedCompetitorsSection).toBeVisible();
    await expect(dashboard.selectedChips).toHaveCount(2);
  });
});
