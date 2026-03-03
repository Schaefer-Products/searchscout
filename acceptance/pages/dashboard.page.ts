import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  // Domain input form
  get domainInput() { return this.page.locator('.domain-input'); }
  get analyzeButton() { return this.page.locator('form.domain-form button[type="submit"]'); }
  get errorMessage() { return this.page.locator('.domain-input-section .error-message'); }

  // Results
  get keywordRows() { return this.page.locator('.keywords-table tbody tr'); }
  get statCards() { return this.page.locator('.stat-card'); }
  get freshDataBadge() { return this.page.locator('.results-section .cache-info.fresh'); }
  get cacheDataBadge() { return this.page.locator('.results-section .cache-info', { hasText: 'Data from cache' }); }
  get emptyState() { return this.page.locator('.empty-state'); }

  // Sorting
  get searchVolumeHeader() {
    return this.page.locator('.keywords-table thead th', { hasText: 'Search Volume' });
  }
  get firstKeywordText() {
    return this.page.locator('.keywords-table tbody tr:first-child .keyword-text');
  }

  // Load more
  get loadMoreButton() { return this.page.locator('.btn-load-more'); }
  get refreshButton() { return this.page.locator('.btn-refresh'); }

  // Competitor flow
  get discoverCompetitorsButton() { return this.page.locator('.btn-discover-competitors'); }
  get selectedCompetitorsSection() { return this.page.locator('.selected-competitors-section'); }
  get selectedChips() { return this.page.locator('.selected-chip'); }

  // Actions
  async analyzeDomain(domain: string): Promise<void> {
    await this.domainInput.fill(domain);
    await this.analyzeButton.click();
  }

  async waitForResults(): Promise<void> {
    await this.keywordRows.first().waitFor({ state: 'visible' });
  }

  async waitForEmptyOrError(): Promise<void> {
    await this.errorMessage.waitFor({ state: 'visible' });
  }
}
