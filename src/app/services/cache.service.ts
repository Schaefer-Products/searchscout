import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Logger } from '../utils/logger';
import { IndexedDbService } from './indexed-db.service';

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheConfig {
  expirationDays: number; // 0 = off, 7, 14, 30, 60, 90
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private readonly CONFIG_KEY = 'cache_config';

  private memoryCache = new Map<string, CacheEntry<any>>();
  private cacheConfig: CacheConfig = { expirationDays: environment.cacheExpirationDays };

  constructor(private db: IndexedDbService) {}

  async initialize(): Promise<void> {
    const config = await this.db.get('keyvalue', this.CONFIG_KEY);
    if (config) {
      this.cacheConfig = config;
    }

    const entries = await this.db.getAll('cache');
    const now = Date.now();
    for (const { key, value } of entries) {
      const entry = value as CacheEntry<any>;
      if (entry.expiresAt < now) {
        void this.db.delete('cache', key);
      } else {
        this.memoryCache.set(key, entry);
      }
    }
  }

  /**
   * Save data to cache with expiration
   */
  save<T>(key: string, data: T, expirationDays?: number): void {
    const days = expirationDays ?? this.cacheConfig.expirationDays;

    if (days === 0) {
      Logger.debug('Cache is disabled, not saving:', key);
      return;
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (days * 24 * 60 * 60 * 1000)
    };

    this.memoryCache.set(key, entry);
    void this.db.set('cache', key, entry);
    Logger.debug('Cached data:', key, 'expires in', days, 'days');
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    if (this.cacheConfig.expirationDays === 0) {
      Logger.debug('Cache is disabled, not retrieving:', key);
      return null;
    }

    const entry = this.memoryCache.get(key);

    if (!entry) {
      Logger.debug('Cache miss:', key);
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      Logger.debug('Cache expired:', key);
      this.remove(key);
      return null;
    }

    Logger.debug('Cache hit:', key, 'age:', this.getAgeInDays(entry.timestamp), 'days');
    return entry.data as T;
  }

  /**
   * Remove item from cache
   */
  remove(key: string): void {
    this.memoryCache.delete(key);
    void this.db.delete('cache', key);
    Logger.debug('Removed from cache:', key);
  }

  /**
   * Clear all cached data
   */
  clearAll(): void {
    this.memoryCache.clear();
    void this.db.clear('cache');
    Logger.debug('Cleared all cache entries');
  }

  /**
   * Get cache metadata (timestamp, age)
   */
  getMetadata(key: string): { timestamp: number; ageInDays: number } | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }
    return {
      timestamp: entry.timestamp,
      ageInDays: this.getAgeInDays(entry.timestamp)
    };
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return this.cacheConfig;
  }

  /**
   * Set cache configuration
   */
  setConfig(config: CacheConfig): void {
    this.cacheConfig = config;
    void this.db.set('keyvalue', this.CONFIG_KEY, config);
    Logger.debug('Cache config updated:', config);
  }

  /**
   * Get total cache size in bytes
   */
  getCacheSize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry).length;
    }
    return size;
  }

  /**
   * Get cache size in MB
   */
  getCacheSizeMB(): number {
    return this.getCacheSize() / (1024 * 1024);
  }

  private getAgeInDays(timestamp: number): number {
    const ageMs = Date.now() - timestamp;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  }
}
