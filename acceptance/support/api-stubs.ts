import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'acceptance', 'fixtures', 'api-responses');

function loadFixture(name: string): object {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8'));
}

/**
 * Stubs GET /serp/google/locations to return a valid credentials response (status_code 20000).
 */
export async function stubValidCredentials(page: Page): Promise<void> {
  await page.route('**/serp/google/locations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loadFixture('locations-success.json')),
    });
  });
}

/**
 * Stubs GET /serp/google/locations to return an unauthorized response (status_code 40100).
 */
export async function stubInvalidCredentials(page: Page): Promise<void> {
  await page.route('**/serp/google/locations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loadFixture('locations-unauthorized.json')),
    });
  });
}

/**
 * Stubs POST /ranked_keywords/live to return keyword data.
 * @param variant 'example' — 2 keywords; 'empty' — 0 keywords (new domain)
 */
export async function stubDomainKeywords(
  page: Page,
  variant: 'example' | 'empty'
): Promise<void> {
  const fixture =
    variant === 'example'
      ? 'ranked-keywords-example.json'
      : 'ranked-keywords-empty.json';
  await page.route('**/ranked_keywords/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loadFixture(fixture)),
    });
  });
}

/**
 * Stubs POST /competitors_domain/live to return 3 competitors (competitor-a/b/c.com).
 */
export async function stubCompetitorDiscovery(page: Page): Promise<void> {
  await page.route('**/competitors_domain/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loadFixture('competitors-example.json')),
    });
  });
}

/**
 * Stubs POST /ranked_keywords/live to return competitor keyword data.
 * @param variant 'standard' — 3 keywords (link building, seo tools, backlink checker);
 *                'many'     — 55 unique competitor keywords for pagination testing
 */
export async function stubCompetitorKeywords(
  page: Page,
  variant: 'standard' | 'many' = 'standard'
): Promise<void> {
  const filename = variant === 'many' ? 'ranked-keywords-many.json' : 'ranked-keywords-competitor.json';
  await page.route('**/ranked_keywords/live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loadFixture(filename)),
    });
  });
}
