import { Injectable } from '@angular/core';
import * as LZString from 'lz-string';
import { environment } from '../../environments/environment';
import { Logger } from '../utils/logger';

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
  private readonly CACHE_PREFIX = 'searchscout_cache_';
  private readonly CONFIG_KEY = 'searchscout_cache_config';

  /**
   * Save data to cache with expiration
   */
  save<T>(key: string, data: T, expirationDays?: number): void {
    const config = this.getConfig();
    const days = expirationDays ?? config.expirationDays;

    // If cache is off (0 days), don't save
    if (days === 0) {
      Logger.debug('Cache is disabled, not saving:', key);
      return;
    }

    const cacheKey = this.CACHE_PREFIX + key;
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (days * 24 * 60 * 60 * 1000)
    };

    try {
      const compressed = LZString.compressToUTF16(JSON.stringify(entry));
      localStorage.setItem(cacheKey, compressed);
      Logger.debug('Cached data:', key, 'expires in', days, 'days');
    } catch (error) {
      Logger.error('Failed to cache data:', error);
      this.handleQuotaExceeded();
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    const config = this.getConfig();

    // If cache is off, don't retrieve
    if (config.expirationDays === 0) {
      Logger.debug('Cache is disabled, not retrieving:', key);
      return null;
    }

    const cacheKey = this.CACHE_PREFIX + key;
    const item = localStorage.getItem(cacheKey);

    if (!item) {
      Logger.debug('Cache miss:', key);
      return null;
    }

    try {
      const decompressed = LZString.decompressFromUTF16(item);
      if (!decompressed) {
        Logger.debug('Cache decompression failed (stale uncompressed entry), evicting:', key);
        this.remove(key);
        return null;
      }
      const entry: CacheEntry<T> = JSON.parse(decompressed);

      // Check if expired
      if (entry.expiresAt < Date.now()) {
        Logger.debug('Cache expired:', key);
        this.remove(key);
        return null;
      }

      Logger.debug('Cache hit:', key, 'age:', this.getAgeInDays(entry.timestamp), 'days');
      return entry.data;
    } catch (error) {
      Logger.error('Failed to parse cache entry:', error);
      this.remove(key);
      return null;
    }
  }

  /**
   * Remove item from cache
   */
  remove(key: string): void {
    const cacheKey = this.CACHE_PREFIX + key;
    localStorage.removeItem(cacheKey);
    Logger.debug('Removed from cache:', key);
  }

  /**
   * Clear all cached data (except config)
   */
  clearAll(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX) && key !== this.CONFIG_KEY) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    Logger.debug('Cleared all cache entries:', keysToRemove.length);
  }

  /**
   * Get cache metadata (timestamp, age)
   */
  getMetadata(key: string): { timestamp: number; ageInDays: number } | null {
    const cacheKey = this.CACHE_PREFIX + key;
    const item = localStorage.getItem(cacheKey);

    if (!item) {
      return null;
    }

    try {
      const decompressed = LZString.decompressFromUTF16(item);
      if (!decompressed) return null;
      const entry: CacheEntry<any> = JSON.parse(decompressed);
      return {
        timestamp: entry.timestamp,
        ageInDays: this.getAgeInDays(entry.timestamp)
      };
    } catch {
      return null;
    }
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    const config = localStorage.getItem(this.CONFIG_KEY);
    if (config) {
      return JSON.parse(config);
    }
    return { expirationDays: environment.cacheExpirationDays };
  }

  /**
   * Set cache configuration
   */
  setConfig(config: CacheConfig): void {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    Logger.debug('Cache config updated:', config);
  }

  /**
   * Get total cache size in bytes
   */
  getCacheSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }
    }
    return size;
  }

  /**
   * Get cache size in MB
   */
  getCacheSizeMB(): number {
    return this.getCacheSize() / (1024 * 1024);
  }

  /**
   * Handle quota exceeded error
   */
  private handleQuotaExceeded(): void {
    Logger.warn('localStorage quota exceeded, clearing oldest entries');

    // Get all cache entries with timestamps
    const entries: Array<{ key: string; timestamp: number }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.CACHE_PREFIX) && key !== this.CONFIG_KEY) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const decompressed = LZString.decompressFromUTF16(item);
            if (decompressed) {
              const entry = JSON.parse(decompressed);
              entries.push({ key, timestamp: entry.timestamp });
            }
          } catch {
            // Not a recognised cache entry, leave it alone
          }
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 25%
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }

    Logger.debug('Removed oldest', toRemove, 'cache entries');
  }

  /**
   * Calculate age in days
   */
  private getAgeInDays(timestamp: number): number {
    const ageMs = Date.now() - timestamp;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  }
}