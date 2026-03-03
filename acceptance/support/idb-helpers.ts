import { Page } from '@playwright/test';

const DB_NAME = 'searchscout';
const DB_VERSION = 1;

/**
 * Deletes the searchscout IndexedDB database before the page loads.
 * Must be called before page.goto().
 */
export async function clearIndexedDb(page: Page): Promise<void> {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase('searchscout');
  });
}

/**
 * Seeds API credentials into the keyvalue store before the page loads.
 * Must be called before page.goto().
 */
export async function seedCredentials(
  page: Page,
  creds: { login: string; password: string }
): Promise<void> {
  await page.addInitScript((credentials: any) => {
    const req = indexedDB.open('searchscout', 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) db.createObjectStore('keyvalue');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      const tx = db.transaction('keyvalue', 'readwrite');
      tx.objectStore('keyvalue').put(credentials, 'credentials');
    };
  }, creds);
}

/**
 * Seeds the current domain into the keyvalue store before the page loads.
 * Must be called before page.goto().
 */
export async function seedCurrentDomain(page: Page, domain: string): Promise<void> {
  await page.addInitScript((d: any) => {
    const req = indexedDB.open('searchscout', 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) db.createObjectStore('keyvalue');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      const tx = db.transaction('keyvalue', 'readwrite');
      tx.objectStore('keyvalue').put(d, 'currentDomain');
    };
  }, domain);
}

/**
 * Seeds selected competitors for a domain into the keyvalue store before the page loads.
 * Must be called before page.goto().
 */
export async function seedSelectedCompetitors(
  page: Page,
  domain: string,
  competitors: Array<{ domain: string; keywordOverlap: number; totalKeywords: number; isManual?: boolean }>
): Promise<void> {
  await page.addInitScript((args: any) => {
    const req = indexedDB.open('searchscout', 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) db.createObjectStore('keyvalue');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      const tx = db.transaction('keyvalue', 'readwrite');
      tx.objectStore('keyvalue').put(args.competitors, 'competitors_' + args.domain);
    };
  }, { domain, competitors });
}

/**
 * Seeds domain keyword cache into the cache store before the page loads.
 * Writes a CacheEntry matching the format used by CacheService.save().
 * Must be called before page.goto().
 */
export async function seedDomainCache(
  page: Page,
  domain: string,
  keywords: Array<Record<string, unknown>>,
  ageInDays: number = 0
): Promise<void> {
  const cacheKey = `domain_keywords_${domain}`;
  const msAgo = ageInDays * 24 * 60 * 60 * 1000;
  await page.addInitScript((args: any) => {
    const req = indexedDB.open('searchscout', 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) db.createObjectStore('keyvalue');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      const now = Date.now();
      const entry = {
        key: args.cacheKey,
        data: args.keywords,
        timestamp: now - args.msAgo,
        expiresAt: now + (7 * 24 * 60 * 60 * 1000),
      };
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put(entry, args.cacheKey);
    };
  }, { cacheKey, keywords, msAgo });
}

/**
 * Seeds a competitor analysis result into the cache store before the page loads.
 * The cache key is: competitor_analysis_<userDomain>_<competitorDomains sorted and joined by comma>
 * Must be called before page.goto().
 */
export async function seedCompetitorAnalysisCache(
  page: Page,
  userDomain: string,
  competitorDomains: string[],
  results: Record<string, unknown>,
  ageInDays: number = 2
): Promise<void> {
  const sorted = [...competitorDomains].sort().join(',');
  const cacheKey = `competitor_analysis_${userDomain}_${sorted}`;
  const msAgo = ageInDays * 24 * 60 * 60 * 1000;
  await page.addInitScript((args: any) => {
    const req = indexedDB.open('searchscout', 1);
    req.onupgradeneeded = (e: any) => {
      const db: IDBDatabase = e.target.result;
      if (!db.objectStoreNames.contains('keyvalue')) db.createObjectStore('keyvalue');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      const now = Date.now();
      const entry = {
        key: args.cacheKey,
        data: args.results,
        timestamp: now - args.msAgo,
        expiresAt: now + (7 * 24 * 60 * 60 * 1000),
      };
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put(entry, args.cacheKey);
    };
  }, { cacheKey, results, msAgo });
}

/**
 * Reads credentials from the keyvalue store after the page has loaded.
 * Must be called after page.goto().
 */
export async function readCredentialsFromIdb(
  page: Page
): Promise<{ login: string; password: string } | null> {
  return page.evaluate((): Promise<{ login: string; password: string } | null> => {
    return new Promise((resolve) => {
      const req = indexedDB.open('searchscout', 1);
      req.onerror = () => resolve(null);
      req.onsuccess = (e: any) => {
        const db: IDBDatabase = e.target.result;
        if (!db.objectStoreNames.contains('keyvalue')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('keyvalue', 'readonly');
        const getReq = tx.objectStore('keyvalue').get('credentials');
        getReq.onsuccess = () => resolve((getReq.result as any) ?? null);
        getReq.onerror = () => resolve(null);
      };
    });
  });
}
