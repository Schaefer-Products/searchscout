import { TestBed } from '@angular/core/testing';
import * as LZString from 'lz-string';

import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CacheService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize default config on construction', () => {
    const config = service.getConfig();
    expect(config).toBeTruthy();
    expect(typeof config.expirationDays).toBe('number');
  });

  describe('save() and get()', () => {
    it('should save and retrieve string data', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello world');
      expect(service.get<string>('testKey')).toBe('hello world');
    });

    it('should save and retrieve object data', () => {
      service.setConfig({ expirationDays: 7 });
      const data = { id: 1, name: 'test', nested: { value: true } };
      service.save('objKey', data);
      expect(service.get<typeof data>('objKey')).toEqual(data);
    });

    it('should not save data when cache is disabled (expirationDays = 0)', () => {
      service.setConfig({ expirationDays: 0 });
      service.save('testKey', 'hello');
      // Even with config disabled, confirm nothing is stored
      expect(localStorage.getItem('searchscout_cache_testKey')).toBeNull();
    });

    it('should return null when get() is called with cache disabled', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 0 });
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should return null for a key that was never saved', () => {
      service.setConfig({ expirationDays: 7 });
      expect(service.get<string>('nonexistent')).toBeNull();
    });

    it('should return null for an expired cache entry and remove it', () => {
      service.setConfig({ expirationDays: 7 });
      const expiredEntry = {
        key: 'testKey',
        data: { value: 42 },
        timestamp: Date.now() - 10000,
        expiresAt: Date.now() - 1000 // already expired
      };
      const cacheKey = 'searchscout_cache_testKey';
      localStorage.setItem(cacheKey, LZString.compressToUTF16(JSON.stringify(expiredEntry)));

      expect(service.get<{ value: number }>('testKey')).toBeNull();
      expect(localStorage.getItem(cacheKey)).toBeNull();
    });

    it('should handle decompression failure and evict the invalid entry', () => {
      service.setConfig({ expirationDays: 7 });
      const cacheKey = 'searchscout_cache_testKey';
      localStorage.setItem(cacheKey, 'not-lz-compressed-data');
      expect(service.get<string>('testKey')).toBeNull();
      expect(localStorage.getItem(cacheKey)).toBeNull();
    });

    it('should handle JSON parse errors and remove the invalid entry', () => {
      service.setConfig({ expirationDays: 7 });
      const cacheKey = 'searchscout_cache_testKey';
      localStorage.setItem(cacheKey, LZString.compressToUTF16('not-valid-json'));
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should use provided expirationDays override instead of config', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value', 30);
      expect(service.get<string>('testKey')).toBe('value');
    });

    it('should not save when override expirationDays is 0', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value', 0);
      expect(service.get<string>('testKey')).toBeNull();
    });
  });

  describe('remove()', () => {
    it('should remove a cached item', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.remove('testKey');
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should not throw when removing a key that does not exist', () => {
      expect(() => service.remove('nonexistent')).not.toThrow();
    });
  });

  describe('clearAll()', () => {
    it('should clear all cache data entries', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('key1', 'value1');
      service.save('key2', 'value2');
      service.clearAll();
      expect(service.get<string>('key1')).toBeNull();
      expect(service.get<string>('key2')).toBeNull();
    });

    it('should preserve the config key after clearAll()', () => {
      service.setConfig({ expirationDays: 14 });
      service.save('key1', 'value1');
      service.clearAll();
      expect(service.getConfig().expirationDays).toBe(14);
    });

    it('should not throw when cache is already empty', () => {
      expect(() => service.clearAll()).not.toThrow();
    });
  });

  describe('getMetadata()', () => {
    it('should return metadata with ageInDays of 0 for a freshly cached entry', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value');
      const meta = service.getMetadata('testKey');
      expect(meta).toBeTruthy();
      expect(meta!.ageInDays).toBe(0);
      expect(meta!.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should return null for a missing key', () => {
      expect(service.getMetadata('nonexistent')).toBeNull();
    });

    it('should return null when decompression fails', () => {
      localStorage.setItem('searchscout_cache_testKey', 'bad-data');
      expect(service.getMetadata('testKey')).toBeNull();
    });
  });

  describe('getConfig() and setConfig()', () => {
    it('should persist the config to localStorage', () => {
      service.setConfig({ expirationDays: 30 });
      expect(service.getConfig().expirationDays).toBe(30);
    });

    it('should update config and the new value is used immediately', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 0 });
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should return a fallback config when localStorage has no entry', () => {
      localStorage.removeItem('searchscout_cache_config');
      const config = service.getConfig();
      expect(config).toBeTruthy();
      expect(typeof config.expirationDays).toBe('number');
    });
  });

  describe('getCacheSize() and getCacheSizeMB()', () => {
    it('should return 0 when no cache entries exist', () => {
      expect(service.getCacheSize()).toBe(0);
    });

    it('should return a positive number after saving data', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'some data to add size to the cache');
      expect(service.getCacheSize()).toBeGreaterThan(0);
    });

    it('getCacheSizeMB() should equal getCacheSize() / (1024 * 1024)', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'data');
      const bytes = service.getCacheSize();
      const mb = service.getCacheSizeMB();
      expect(mb).toBeCloseTo(bytes / (1024 * 1024), 10);
    });

    it('should increase after saving additional entries', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('key1', 'first value');
      const sizeAfterFirst = service.getCacheSize();
      service.save('key2', 'second value');
      expect(service.getCacheSize()).toBeGreaterThan(sizeAfterFirst);
    });
  });
});
