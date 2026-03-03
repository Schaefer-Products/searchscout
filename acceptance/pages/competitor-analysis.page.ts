import { Page } from '@playwright/test';

export class CompetitorAnalysisPage {
  constructor(private readonly page: Page) {}

  // State — scoped to competitor analysis container
  get container() { return this.page.locator('.competitor-analysis-container'); }
  get loadingState() { return this.container.locator('.loading-state'); }
  get resultsContainer() { return this.container.locator('.results-container'); }
  get errorMessage() { return this.container.locator('.error-message'); }

  // Cache info (in .cache-header)
  get cacheDataBadge() { return this.container.locator('.cache-header .cache-info', { hasText: 'Data from cache' }); }
  get freshDataBadge() { return this.container.locator('.cache-header .cache-info.fresh'); }
  get refreshButton() { return this.container.locator('.cache-header .btn-refresh'); }

  // Export
  get exportButton() { return this.container.locator('.export-row .btn-export'); }

  // Stats (in .stats-grid) — scoped to avoid matching the dashboard stats
  get opportunitiesCount() { return this.container.locator('.stat-card.highlight .stat-value'); }
  get blogTopicsCount() { return this.container.locator('.stat-card.blog-topics .stat-value'); }
  get sharedCount() { return this.container.locator('.stat-card:has(.stat-label:text("Shared Keywords")) .stat-value'); }
  get uniqueCount() { return this.container.locator('.stat-card:has(.stat-label:text("Your Unique Keywords")) .stat-value'); }
  get totalCount() { return this.container.locator('.stat-card:has(.stat-label:text("Total Keywords")) .stat-value'); }

  // Tabs (in .view-tabs)
  get opportunitiesTab() { return this.container.locator('.view-tabs .tab', { hasText: 'Opportunities' }); }
  get blogTopicsTab() { return this.container.locator('.view-tabs .tab.blog-tab'); }
  get allKeywordsTab() { return this.container.locator('.view-tabs .tab', { hasText: 'All Keywords' }); }
  get sharedTab() { return this.container.locator('.view-tabs .tab', { hasText: 'Shared' }); }
  get yourUniqueTab() { return this.container.locator('.view-tabs .tab', { hasText: 'Your Unique' }); }

  // Keywords table — scoped to the analysis container to avoid matching the dashboard table
  get keywordRows() { return this.container.locator('.table-container .keywords-table tbody tr'); }
  get firstKeywordText() { return this.container.locator('.keywords-table tbody tr:first-child .keyword-text'); }
  get difficultyHeader() { return this.container.locator('.keywords-table thead th.sortable', { hasText: 'Difficulty' }); }
  get volumeHeader() { return this.container.locator('.keywords-table thead th.sortable', { hasText: 'Volume' }); }
  get opportunityScoreHeader() { return this.container.locator('.keywords-table thead th.sortable', { hasText: 'Opportunity Score' }); }
  get positionHeader() { return this.container.locator('.keywords-table thead th', { hasText: 'Your Position' }); }
  get loadMoreButton() { return this.container.locator('.load-more-container .btn-load-more'); }

  // Blog topics (in .blog-topics-container)
  get blogTopicsContainer() { return this.container.locator('.blog-topics-container'); }
  get topicCards() { return this.container.locator('.topic-card'); }
  get loadMoreTopicsButton() { return this.container.locator('.load-more-topics .btn-load-more'); }

  // Actions
  async waitForAnalysisComplete(): Promise<void> {
    await this.resultsContainer.waitFor({ state: 'visible', timeout: 15000 });
  }

  async clickTab(name: 'Opportunities' | 'Blog Topics' | 'All Keywords' | 'Shared' | 'Your Unique'): Promise<void> {
    if (name === 'Blog Topics') {
      await this.blogTopicsTab.click();
    } else if (name === 'All Keywords') {
      await this.allKeywordsTab.click();
    } else if (name === 'Shared') {
      await this.sharedTab.click();
    } else if (name === 'Your Unique') {
      await this.yourUniqueTab.click();
    } else {
      await this.opportunitiesTab.click();
    }
  }

  async getDifficultyValues(): Promise<number[]> {
    const texts = await this.container.locator('.keywords-table tbody tr .difficulty-value').allTextContents();
    return texts.map(t => parseInt(t.trim(), 10));
  }

  async getOpportunityScores(): Promise<number[]> {
    const texts = await this.container.locator('.keywords-table tbody tr .score-cell .score-badge').allTextContents();
    return texts.map(t => parseInt(t.trim(), 10));
  }

  async getKeywordTexts(): Promise<string[]> {
    return this.container.locator('.keywords-table tbody tr .keyword-text').allTextContents();
  }
}
