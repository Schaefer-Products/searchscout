import { Page } from '@playwright/test';

export class SetupPage {
  constructor(private readonly page: Page) {}

  // Inputs
  get loginInput() { return this.page.locator('#login'); }
  get passwordInput() { return this.page.locator('#password'); }

  // Buttons
  get submitButton() { return this.page.locator('button[type="submit"].btn-primary'); }
  get goToDashboardButton() { return this.page.getByRole('button', { name: 'Go to Dashboard' }); }
  get resetCredentialsButton() { return this.page.getByRole('button', { name: 'Reset Credentials' }); }

  // State
  get errorMessage() { return this.page.locator('.error-message'); }
  get alreadySetUpHeading() { return this.page.getByRole('heading', { name: "You're already set up" }); }

  // Actions
  async fillCredentials(login: string, password: string): Promise<void> {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async goToDashboard(): Promise<void> {
    await this.goToDashboardButton.click();
  }

  async resetCredentials(): Promise<void> {
    await this.resetCredentialsButton.click();
  }
}
