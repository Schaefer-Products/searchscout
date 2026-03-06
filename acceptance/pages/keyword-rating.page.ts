import { Locator, Page } from '@playwright/test';

/**
 * Page object for keyword rating interactions.
 *
 * Keyword rating controls are expected to render inside each keyword row
 * in the `.keywords-table tbody`. Each row contains a `.keyword-text` cell
 * that identifies the keyword, and a `.rating-control` group that holds
 * five emoji rating buttons (data-rating="0" through data-rating="4").
 *
 * Rating 0 (🚫) hides the keyword from the default view. The hidden keywords
 * toggle and undo toast are rendered outside the table, scoped to the
 * nearest `.results-section` or `.competitor-analysis-container`.
 */
export class KeywordRatingPage {
  constructor(private readonly page: Page) {}

  // ---------------------------------------------------------------------------
  // Keyword row helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the row locator for a given keyword text.
   * Matches the first `<tr>` that contains a `.keyword-text` with exact text.
   */
  private keywordRow(keyword: string): Locator {
    return this.page.locator('.keywords-table tbody tr', {
      has: this.page.locator('.keyword-text', { hasText: keyword }),
    });
  }

  /**
   * Returns the `.rating-control` group locator within the given keyword's row.
   */
  getRatingControl(keyword: string): Locator {
    return this.keywordRow(keyword).locator('.rating-control');
  }

  /**
   * Clicks an emoji rating button on a keyword row.
   * @param keyword  The keyword text to target.
   * @param rating   0 = 🚫 (hidden), 1–4 = progressively positive ratings.
   */
  async clickRating(keyword: string, rating: 0 | 1 | 2 | 3 | 4): Promise<void> {
    const btn = this.getRatingControl(keyword).locator(`[data-rating="${rating}"]`);
    await btn.click();
  }

  /**
   * Returns the currently selected rating value for a keyword, or undefined
   * if no rating has been selected.
   */
  async getCurrentRating(keyword: string): Promise<number | undefined> {
    const activeBtn = this.getRatingControl(keyword).locator('.rating-btn.active, [data-rating].active, [data-rating][aria-pressed="true"]');
    const count = await activeBtn.count();
    if (count === 0) return undefined;
    const ratingAttr = await activeBtn.first().getAttribute('data-rating');
    if (ratingAttr === null) return undefined;
    return parseInt(ratingAttr, 10);
  }

  /**
   * Whether a keyword row is currently visible (not hidden by CSS or DOM removal).
   * Returns false when the row is either absent from the DOM or hidden via CSS.
   */
  async isKeywordVisible(keyword: string): Promise<boolean> {
    const row = this.keywordRow(keyword);
    const count = await row.count();
    if (count === 0) return false;
    return row.first().isVisible();
  }

  /**
   * Whether a keyword row carries hidden styling (e.g. strikethrough, greyed-out).
   * Checks for the `.keyword-hidden` class on the row or the `.keyword-text` cell.
   */
  async isKeywordHiddenStyle(keyword: string): Promise<boolean> {
    const row = this.keywordRow(keyword);
    const count = await row.count();
    if (count === 0) return false;
    const rowClass = await row.first().getAttribute('class') ?? '';
    if (rowClass.includes('keyword-hidden') || rowClass.includes('row-hidden')) return true;
    const textCell = row.first().locator('.keyword-text');
    const cellClass = await textCell.getAttribute('class') ?? '';
    return cellClass.includes('hidden') || cellClass.includes('strikethrough') || cellClass.includes('greyed');
  }

  // ---------------------------------------------------------------------------
  // Hidden keywords toggle
  // ---------------------------------------------------------------------------

  /**
   * Returns the locator for the "Show hidden keywords (N)" toggle button.
   */
  getHiddenKeywordsToggle(): Locator {
    return this.page.locator('.btn-show-hidden, [data-testid="show-hidden-toggle"]');
  }

  /**
   * Clicks the "Show hidden keywords" toggle.
   */
  async toggleShowHidden(): Promise<void> {
    await this.getHiddenKeywordsToggle().click();
  }

  /**
   * Extracts the hidden keyword count N from text like "Show hidden keywords (N)"
   * or "Hide hidden keywords (N)". Returns 0 if the toggle is absent or unparseable.
   */
  async getHiddenCount(): Promise<number> {
    const toggle = this.getHiddenKeywordsToggle();
    const count = await toggle.count();
    if (count === 0) return 0;
    const text = await toggle.first().textContent() ?? '';
    const match = text.match(/\((\d+)\)/);
    if (!match) return 0;
    return parseInt(match[1], 10);
  }

  // ---------------------------------------------------------------------------
  // Undo toast
  // ---------------------------------------------------------------------------

  /**
   * Returns the locator for the undo toast notification that appears after
   * a keyword is rated 0 (hidden).
   */
  getUndoToast(): Locator {
    return this.page.locator('.undo-toast, [data-testid="undo-toast"]');
  }

  /**
   * Clicks the Undo button inside the undo toast.
   */
  async clickUndo(): Promise<void> {
    const undoBtn = this.getUndoToast().locator('button', { hasText: /undo/i });
    await undoBtn.click();
  }

  // ---------------------------------------------------------------------------
  // Hint row
  // ---------------------------------------------------------------------------

  /**
   * Returns the locator for the first-visit hint row that explains how rating works.
   */
  getHintRow(): Locator {
    return this.page.locator('.rating-hint-row, [data-testid="rating-hint"]');
  }

  // ---------------------------------------------------------------------------
  // Blog Topics stale banner
  // ---------------------------------------------------------------------------

  /**
   * Returns the locator for the stale-topics banner that appears after a rating
   * change invalidates the current blog topic recommendations.
   */
  getStaleBanner(): Locator {
    return this.page.locator('.topics-stale-banner, [data-testid="topics-stale-banner"]');
  }

  /**
   * Clicks "Regenerate topics" on the stale banner.
   */
  async clickRegenerate(): Promise<void> {
    const btn = this.getStaleBanner().locator('button', { hasText: /regenerate/i });
    await btn.click();
  }
}
