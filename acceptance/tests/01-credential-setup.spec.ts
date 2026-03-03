import { test, expect } from '@playwright/test';
import { clearIndexedDb, seedCredentials, readCredentialsFromIdb } from '../support/idb-helpers';
import { stubValidCredentials, stubInvalidCredentials } from '../support/api-stubs';
import { SetupPage } from '../pages/setup.page';

test.describe('API Key Setup', () => {
  test('valid credentials are saved and redirect to dashboard', async ({ page }) => {
    await clearIndexedDb(page);
    await stubValidCredentials(page);
    await page.goto('/setup');

    const setup = new SetupPage(page);
    await setup.fillCredentials('test@example.com', 'valid-password');
    await setup.submit();

    await expect(page).toHaveURL(/\/dashboard/);

    const savedCreds = await readCredentialsFromIdb(page);
    expect(savedCreds).not.toBeNull();
    expect(savedCreds?.login).toBe('test@example.com');
  });

  test('invalid credentials show error and stay on setup page', async ({ page }) => {
    await clearIndexedDb(page);
    await stubInvalidCredentials(page);
    await page.goto('/setup');

    const setup = new SetupPage(page);
    await setup.fillCredentials('test@example.com', 'wrong-password');
    await setup.submit();

    await expect(setup.errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/setup/);
  });

  test('already-configured state shows dashboard button and hides form', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'existing@example.com', password: 'saved-pass' });
    await page.goto('/setup');

    const setup = new SetupPage(page);
    await expect(setup.goToDashboardButton).toBeVisible();
    await expect(setup.resetCredentialsButton).toBeVisible();
    await expect(setup.loginInput).not.toBeVisible();
  });

  test('reset credentials hides the already-set-up card and shows the form', async ({ page }) => {
    await clearIndexedDb(page);
    await seedCredentials(page, { login: 'existing@example.com', password: 'saved-pass' });
    await page.goto('/setup');

    const setup = new SetupPage(page);
    await expect(setup.goToDashboardButton).toBeVisible();

    await setup.resetCredentials();

    await expect(setup.loginInput).toBeVisible();
    await expect(setup.submitButton).toBeVisible();
    await expect(setup.goToDashboardButton).not.toBeVisible();
  });
});
