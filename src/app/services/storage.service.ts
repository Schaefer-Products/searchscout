import { Injectable } from '@angular/core';
import { Competitor } from '../models/competitor.model';
import { Logger } from '../utils/logger';
import { IndexedDbService } from './indexed-db.service';

export interface ApiCredentials {
  login: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly API_CREDS_KEY = 'credentials';
  private readonly CURRENT_DOMAIN_KEY = 'currentDomain';
  private readonly SELECTED_COMPETITORS_PREFIX = 'competitors_';

  // Legacy localStorage keys for first-run migration
  private readonly LS_API_CREDS_KEY = 'searchscout_api_credentials';
  private readonly LS_SELECTED_COMPETITORS_KEY = 'searchscout_selected_competitors';
  private readonly LS_CURRENT_DOMAIN_KEY = 'searchscout_current_domain';

  private credentials: ApiCredentials | null = null;
  private currentDomain: string | null = null;
  private competitorsMap = new Map<string, Competitor[]>();

  constructor(private db: IndexedDbService) {}

  async initialize(): Promise<void> {
    const entries = await this.db.getAll('keyvalue');

    if (entries.length === 0) {
      await this.migrateFromLocalStorage();
      return;
    }

    for (const { key, value } of entries) {
      if (key === this.API_CREDS_KEY) {
        this.credentials = value;
      } else if (key === this.CURRENT_DOMAIN_KEY) {
        this.currentDomain = value;
      } else if (key.startsWith(this.SELECTED_COMPETITORS_PREFIX)) {
        const domain = key.slice(this.SELECTED_COMPETITORS_PREFIX.length);
        this.competitorsMap.set(domain, value);
      }
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    const credsStr = localStorage.getItem(this.LS_API_CREDS_KEY);
    if (credsStr) {
      try {
        const creds = JSON.parse(credsStr) as ApiCredentials;
        this.credentials = creds;
        void this.db.set('keyvalue', this.API_CREDS_KEY, creds);
        localStorage.removeItem(this.LS_API_CREDS_KEY);
      } catch {
        Logger.error('Migration: failed to parse credentials from localStorage');
      }
    }

    const domain = localStorage.getItem(this.LS_CURRENT_DOMAIN_KEY);
    if (domain) {
      this.currentDomain = domain;
      void this.db.set('keyvalue', this.CURRENT_DOMAIN_KEY, domain);
      localStorage.removeItem(this.LS_CURRENT_DOMAIN_KEY);
    }

    const prefix = this.LS_SELECTED_COMPETITORS_KEY + '_';
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToMigrate.push(key);
      }
    }

    for (const lsKey of keysToMigrate) {
      const compDomain = lsKey.slice(prefix.length);
      const stored = localStorage.getItem(lsKey);
      if (stored) {
        try {
          const competitors = JSON.parse(stored) as Competitor[];
          this.competitorsMap.set(compDomain, competitors);
          void this.db.set('keyvalue', this.SELECTED_COMPETITORS_PREFIX + compDomain, competitors);
          localStorage.removeItem(lsKey);
        } catch {
          Logger.error('Migration: failed to parse competitors for domain:', compDomain);
        }
      }
    }
  }

  /**
   * Save API credentials
   */
  saveCredentials(credentials: ApiCredentials): void {
    this.credentials = credentials;
    void this.db.set('keyvalue', this.API_CREDS_KEY, credentials);
  }

  /**
   * Retrieve API credentials
   */
  getCredentials(): ApiCredentials | null {
    return this.credentials;
  }

  /**
   * Check if credentials exist
   */
  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  /**
   * Remove credentials
   */
  clearCredentials(): void {
    this.credentials = null;
    void this.db.delete('keyvalue', this.API_CREDS_KEY);
  }

  /**
   * Save selected competitors for a domain
   */
  saveSelectedCompetitors(domain: string, competitors: Competitor[]): void {
    this.competitorsMap.set(domain, competitors);
    void this.db.set('keyvalue', this.SELECTED_COMPETITORS_PREFIX + domain, competitors);
  }

  /**
   * Get selected competitors for a domain
   */
  getSelectedCompetitors(domain: string): Competitor[] | null {
    return this.competitorsMap.get(domain) ?? null;
  }

  /**
   * Clear selected competitors for a domain
   */
  clearSelectedCompetitors(domain: string): void {
    this.competitorsMap.delete(domain);
    void this.db.delete('keyvalue', this.SELECTED_COMPETITORS_PREFIX + domain);
  }

  /**
   * Save current domain being analyzed
   */
  saveCurrentDomain(domain: string): void {
    this.currentDomain = domain;
    void this.db.set('keyvalue', this.CURRENT_DOMAIN_KEY, domain);
  }

  /**
   * Get current domain being analyzed
   */
  getCurrentDomain(): string | null {
    return this.currentDomain;
  }

  /**
   * Clear current domain
   */
  clearCurrentDomain(): void {
    this.currentDomain = null;
    void this.db.delete('keyvalue', this.CURRENT_DOMAIN_KEY);
  }
}
