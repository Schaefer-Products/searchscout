import { Page } from '@playwright/test';

export class CompetitorSelectionPage {
  constructor(private readonly page: Page) {}

  // Discovery
  get discoverButton() { return this.page.locator('.btn-discover'); }
  get competitorCards() { return this.page.locator('.competitor-card'); }
  get selectedCards() { return this.page.locator('.competitor-card.selected'); }

  // Manual entry
  get manualDomainInput() { return this.page.locator('input[name="manualDomain"]'); }
  get addButton() { return this.page.locator('.btn-add'); }
  get manualError() { return this.page.locator('.manual-error'); }
  get manualBadges() { return this.page.locator('.badge.manual'); }
  get removeButtons() { return this.page.locator('.btn-remove'); }

  // Confirmation
  get confirmButton() { return this.page.locator('.btn-confirm'); }

  // Actions
  async discover(): Promise<void> {
    await this.discoverButton.click();
    await this.competitorCards.first().waitFor({ state: 'visible' });
  }

  async addManualCompetitor(domain: string): Promise<void> {
    await this.manualDomainInput.fill(domain);
    await this.addButton.click();
  }

  async toggleCompetitor(index: number): Promise<void> {
    await this.competitorCards.nth(index).click();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }
}
