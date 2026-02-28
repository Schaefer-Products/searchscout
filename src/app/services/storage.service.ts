import { Injectable } from '@angular/core';
import { Competitor } from '../models/competitor.model';
import { Logger } from '../utils/logger';

export interface ApiCredentials {
  login: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly API_CREDS_KEY = 'searchscout_api_credentials';
  private readonly SELECTED_COMPETITORS_KEY = 'searchscout_selected_competitors';
  private readonly CURRENT_DOMAIN_KEY = 'searchscout_current_domain';

  /**
   * Save API credentials to localStorage
   */
  saveCredentials(credentials: ApiCredentials): void {
    localStorage.setItem(this.API_CREDS_KEY, JSON.stringify(credentials));
  }

  /**
   * Retrieve API credentials from localStorage
   */
  getCredentials(): ApiCredentials | null {
    const stored = localStorage.getItem(this.API_CREDS_KEY);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as ApiCredentials;
    } catch (error) {
      Logger.error('Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Check if credentials exist in storage
   */
  hasCredentials(): boolean {
    return this.getCredentials() !== null;
  }

  /**
   * Remove credentials from storage
   */
  clearCredentials(): void {
    localStorage.removeItem(this.API_CREDS_KEY);
  }

  /**
   * Save selected competitors for a domain
   */
  saveSelectedCompetitors(domain: string, competitors: Competitor[]): void {
    const key = `${this.SELECTED_COMPETITORS_KEY}_${domain}`;
    localStorage.setItem(key, JSON.stringify(competitors));
  }

  /**
   * Get selected competitors for a domain
   */
  getSelectedCompetitors(domain: string): Competitor[] | null {
    const key = `${this.SELECTED_COMPETITORS_KEY}_${domain}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as Competitor[];
    } catch (error) {
      Logger.error('Failed to parse selected competitors:', error);
      return null;
    }
  }

  /**
   * Clear selected competitors for a domain
   */
  clearSelectedCompetitors(domain: string): void {
    const key = `${this.SELECTED_COMPETITORS_KEY}_${domain}`;
    localStorage.removeItem(key);
  }

  /**
   * Save current domain being analyzed
   */
  saveCurrentDomain(domain: string): void {
    localStorage.setItem(this.CURRENT_DOMAIN_KEY, domain);
  }

  /**
   * Get current domain being analyzed
   */
  getCurrentDomain(): string | null {
    return localStorage.getItem(this.CURRENT_DOMAIN_KEY);
  }

  /**
   * Clear current domain
   */
  clearCurrentDomain(): void {
    localStorage.removeItem(this.CURRENT_DOMAIN_KEY);
  }
}