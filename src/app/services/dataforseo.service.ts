import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StorageService, ApiCredentials } from './storage.service';
import { CacheService } from './cache.service';
import { Logger } from '../utils/logger';
import { Competitor, DataForSeoCompetitorsResponse } from '../models/competitor.model';
import { DomainKeywordRanking, DataForSeoRankedKeywordsResponse } from '../models/keyword.model';


export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataforseoService {
  private http = inject(HttpClient);
  private storage = inject(StorageService);
  private cache = inject(CacheService);

  /**
   * Validate API credentials using DataForSEO Sandbox
   * This is a FREE test call that doesn't consume credits
   */
  validateCredentials(login: string, password: string): Observable<ValidationResult> {
    const url = `${environment.dataforSeoApiUrl}/serp/google/locations`;

    const headers = this.createAuthHeaders(login, password);

    return this.http.get<any>(url, { headers }).pipe(
      map(response => {
        Logger.log('DataForSEO response:', response); // Debug log
        // DataForSEO returns status_code 20000 for success
        if (response.status_code === 20000) {
          return { isValid: true };
        } else if (response.status_code === 40100) {
          // Specific error for unauthorized
          return {
            isValid: false,
            error: 'Invalid login or password. Check your credentials at https://app.dataforseo.com/api-access'
          };
        } else {
          return {
            isValid: false,
            error: `API returned status: ${response.status_code} - ${response.status_message}`
          };
        }
      }),
      catchError(error => {
        Logger.error('HTTP error:', error); // Debug log
        // Handle HTTP errors (401 = unauthorized, etc.)
        let errorMessage = 'Failed to validate credentials';

        if (error.status === 0) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.error?.status_message) {
          errorMessage = error.error.status_message;
        }

        return throwError(() => ({ isValid: false, error: errorMessage }));
      })
    );
  }

  /**
   * Get stored credentials
   */
  getStoredCredentials(): ApiCredentials | null {
    return this.storage.getCredentials();
  }

  /**
   * Save credentials after validation
   */
  saveCredentials(credentials: ApiCredentials): void {
    this.storage.saveCredentials(credentials);
  }

  /**
   * Remove stored credentials
   */
  clearCredentials(): void {
    this.storage.clearCredentials();
  }

  /**
   * Check if user has stored credentials
   */
  hasCredentials(): boolean {
    return this.storage.hasCredentials();
  }

  /**
   * Create HTTP headers with Basic Authentication
   */
  private createAuthHeaders(login: string, password: string): HttpHeaders {
    const credentials = btoa(`${login}:${password}`);
    return new HttpHeaders({
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Create headers using stored credentials
   */
  getAuthHeaders(): HttpHeaders | null {
    const creds = this.getStoredCredentials();
    if (!creds) {
      return null;
    }
    return this.createAuthHeaders(creds.login, creds.password);
  }

  /**
   * Fetch ranked keywords for a domain
   * Uses cache if available, otherwise calls API
   */
  fetchDomainKeywords(domain: string, useCache: boolean = true): Observable<DomainKeywordRanking[]> {
    const cacheKey = `domain_keywords_${domain}`;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<DomainKeywordRanking[]>(cacheKey);
      if (cached) {
        Logger.debug('Using cached keywords for:', domain);
        return of(cached);
      }
    }

    Logger.debug('Fetching keywords from API for:', domain);

    const url = `${environment.dataforSeoApiUrl}/dataforseo_labs/google/ranked_keywords/live`;

    const body = [{
      target: domain,
      location_name: 'United States',
      language_name: 'English',
      limit: 1000, // Maximum keywords per call
      load_rank_absolute: true,
      filters: [
        ['keyword_data.keyword_info.search_volume', '>', 0] // Only keywords with volume
      ]
    }];

    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => ({ error: 'No API credentials found' }));
    }

    return this.http.post<DataForSeoRankedKeywordsResponse>(url, body, { headers }).pipe(
      map(response => this.parseKeywordResponse(response)),
      tap(keywords => {
        // Cache the results
        this.cache.save(cacheKey, keywords);
        Logger.debug('Cached', keywords.length, 'keywords for:', domain);
      }),
      catchError(error => {
        Logger.error('Error fetching domain keywords:', error);

        let errorMessage = 'Failed to fetch keywords';

        if (error.status === 401 || error.status === 40100) {
          errorMessage = 'Invalid API credentials. Please update them in settings.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.error?.status_message) {
          errorMessage = error.error.status_message;
        }

        return throwError(() => ({ error: errorMessage }));
      })
    );
  }

  /**
   * Parse DataForSEO API response into our RankedKeyword model
   */
  private parseKeywordResponse(response: DataForSeoRankedKeywordsResponse): DomainKeywordRanking[] {
    Logger.debug('Parsing DataForSEO response:', response);

    if (response.status_code !== 20000) {
      Logger.error('API returned non-success status:', response.status_code);
      throw new Error(response.status_message || 'API request failed');
    }

    const tasks = response.tasks || [];
    Logger.debug('Tasks array length:', tasks.length);

    if (tasks.length === 0) {
      Logger.warn('No tasks in response');
      return [];
    }

    const result = tasks[0]?.result?.[0];
    Logger.debug('Result object:', result);

    if (!result || !result.items) {
      Logger.warn('No items in result');
      return [];
    }

    Logger.debug('Items count:', result.items.length);

    const keywords: DomainKeywordRanking[] = result.items.map((item, index) => {
      try {
        return {
          keyword: item.keyword_data.keyword,
          searchVolume: item.keyword_data.keyword_info.search_volume || 0,
          difficulty: Math.round((item.keyword_data.keyword_info.competition || 0) * 100), // Convert 0-1 to 0-100
          position: item.ranked_serp_element.serp_item.rank_absolute,
          etv: item.ranked_serp_element.serp_item.etv,
          cpc: item.keyword_data.keyword_info.cpc
        };
      } catch (err) {
        Logger.error('Error parsing keyword at index', index, ':', err);
        Logger.error('Problematic item:', item);
        // Return a minimal valid object to avoid breaking the whole array
        return {
          keyword: 'Error parsing keyword',
          searchVolume: 0,
          difficulty: 0,
          position: 999
        };
      }
    });

    Logger.debug('Parsed keywords count:', keywords.length);
    return keywords;
  }

  /**
   * Get cache metadata for a domain
   */
  getDomainCacheMetadata(domain: string): { timestamp: number; ageInDays: number } | null {
    const cacheKey = `domain_keywords_${domain}`;
    return this.cache.getMetadata(cacheKey);
  }

  /**
   * Clear cache for a specific domain
   */
  clearDomainCache(domain: string): void {
    const cacheKey = `domain_keywords_${domain}`;
    this.cache.remove(cacheKey);
  }

  /**
 * Fetch competitor domains for a given domain
 * Uses cache if available, otherwise calls API
 */
  discoverCompetitors(domain: string, useCache: boolean = true): Observable<Competitor[]> {
    const cacheKey = `competitors_${domain}`;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<Competitor[]>(cacheKey);
      if (cached) {
        Logger.debug('Using cached competitors for:', domain);
        return of(cached);
      }
    }

    Logger.debug('Fetching competitors from API for:', domain);

    const url = `${environment.dataforSeoApiUrl}/dataforseo_labs/google/competitors_domain/live`;

    const body = [{
      target: domain,
      location_name: 'United States',
      language_name: 'English',
      limit: 1000, // Fetch maximum competitors in one call
      filters: [
        ['intersections', '>=', 10] // Must have at least 10 overlapping keywords
      ],
      order_by: ['intersections,desc'], // Sort by keyword overlap
      exclude_top_domains: true,
      exclude_domains: environment.excludedCompetitorDomains
    }];

    const headers = this.getAuthHeaders();
    if (!headers) {
      return throwError(() => ({ error: 'No API credentials found' }));
    }

    return this.http.post<DataForSeoCompetitorsResponse>(url, body, { headers }).pipe(
      map(response => {
        const competitors = this.parseCompetitorsResponse(response);
        // Sort by keyword overlap (in case order_by doesn't work)
        return competitors.sort((a, b) => b.keywordOverlap - a.keywordOverlap);
      }),
      tap(competitors => {
        // Cache the results
        this.cache.save(cacheKey, competitors);
        Logger.debug('Cached', competitors.length, 'competitors for:', domain);
      }),
      catchError(error => {
        Logger.error('Error fetching competitors:', error);

        let errorMessage = 'Failed to discover competitors';

        if (error.status === 401 || error.status === 40100) {
          errorMessage = 'Invalid API credentials. Please update them in settings.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.error?.status_message) {
          errorMessage = error.error.status_message;
        }

        return throwError(() => ({ error: errorMessage }));
      })
    );
  }

  /**
   * Parse DataForSEO competitors API response into our Competitor model
   */
  private parseCompetitorsResponse(response: DataForSeoCompetitorsResponse): Competitor[] {
    Logger.debug('Parsing DataForSEO competitors response:', response);

    // Check main status code
    if (response.status_code !== 20000) {
      Logger.error('API returned non-success status:', response.status_code);
      throw new Error(response.status_message || 'API request failed');
    }

    const tasks = response.tasks || [];
    if (tasks.length === 0) {
      Logger.warn('No tasks in response');
      return [];
    }

    // Check task-level status code
    const task = tasks[0];
    if (task.status_code && task.status_code !== 20000) {
      Logger.error('Task returned error:', task.status_code, task.status_message);
      throw new Error(task.status_message || `Task failed with code: ${task.status_code}`);
    }

    const result = task.result?.[0];
    if (!result || !result.items) {
      Logger.warn('No items in result');
      return [];
    }

    const competitors: Competitor[] = result.items.map(item => ({
      domain: item.domain,
      keywordOverlap: item.metrics.organic.intersections,
      totalKeywords: item.metrics.organic.count,
      etv: item.metrics.organic.etv,
      averagePosition: item.avg_position,
      isManual: false
    }));

    Logger.debug('Parsed', competitors.length, 'competitors');
    return competitors;
  }

  /**
   * Get cache metadata for competitors
   */
  getCompetitorsCacheMetadata(domain: string): { timestamp: number; ageInDays: number } | null {
    const cacheKey = `competitors_${domain}`;
    return this.cache.getMetadata(cacheKey);
  }

  /**
   * Clear cache for competitors of a specific domain
   */
  clearCompetitorsCache(domain: string): void {
    const cacheKey = `competitors_${domain}`;
    this.cache.remove(cacheKey);
  }
}