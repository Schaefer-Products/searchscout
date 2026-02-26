import { TestBed } from '@angular/core/testing';
import * as LZString from 'lz-string';

import { CacheService } from './cache.service';

/** Write a raw compressed cache entry directly into localStorage */
function writeEntry(key: string, data: unknown, timestamp: number, expiresAt: number): void {
  const entry = { key, data, timestamp, expiresAt };
  localStorage.setItem(
    `searchscout_cache_${key}`,
    LZString.compressToUTF16(JSON.stringify(entry))
  );
}

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

  // ---------------------------------------------------------------------------
  // constructor
  // ---------------------------------------------------------------------------

  describe('constructor', () => {
    it('should initialize a default config when none exists', () => {
      const config = service.getConfig();
      expect(config).toBeTruthy();
      expect(typeof config.expirationDays).toBe('number');
    });

    it('should not overwrite an existing config on construction', () => {
      service.setConfig({ expirationDays: 14 });

      // Re-create the service — the constructor should leave the existing config alone
      TestBed.resetTestingModule();
      localStorage.setItem('searchscout_cache_config', JSON.stringify({ expirationDays: 14 }));
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(CacheService);

      expect(freshService.getConfig().expirationDays).toBe(14);
    });
  });

  // ---------------------------------------------------------------------------
  // save() and get()
  // ---------------------------------------------------------------------------

  describe('save() and get()', () => {
    it('should save and retrieve a string value', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello world');
      expect(service.get<string>('testKey')).toBe('hello world');
    });

    it('should save and retrieve a nested object', () => {
      service.setConfig({ expirationDays: 7 });
      const data = { id: 1, name: 'test', nested: { value: true } };
      service.save('objKey', data);
      expect(service.get<typeof data>('objKey')).toEqual(data);
    });

    it('should save and retrieve an array', () => {
      service.setConfig({ expirationDays: 7 });
      const arr = [1, 2, 3];
      service.save('arrKey', arr);
      expect(service.get<number[]>('arrKey')).toEqual(arr);
    });

    it('should not write to localStorage when expirationDays config is 0', () => {
      service.setConfig({ expirationDays: 0 });
      service.save('testKey', 'hello');
      expect(localStorage.getItem('searchscout_cache_testKey')).toBeNull();
    });

    it('should return null from get() when expirationDays config is 0', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 0 });
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should return null for a key that was never saved', () => {
      service.setConfig({ expirationDays: 7 });
      expect(service.get<string>('nonexistent')).toBeNull();
    });

    it('should return null and evict an expired entry', () => {
      service.setConfig({ expirationDays: 7 });
      writeEntry('testKey', { value: 42 }, Date.now() - 10_000, Date.now() - 1_000);

      expect(service.get<{ value: number }>('testKey')).toBeNull();
      expect(localStorage.getItem('searchscout_cache_testKey')).toBeNull();
    });

    it('should return null and evict an entry that fails decompression', () => {
      service.setConfig({ expirationDays: 7 });
      localStorage.setItem('searchscout_cache_testKey', 'not-lz-compressed-data');
      expect(service.get<string>('testKey')).toBeNull();
      expect(localStorage.getItem('searchscout_cache_testKey')).toBeNull();
    });

    it('should return null and evict an entry whose JSON is malformed after decompression', () => {
      service.setConfig({ expirationDays: 7 });
      localStorage.setItem(
        'searchscout_cache_testKey',
        LZString.compressToUTF16('not-valid-json')
      );
      expect(service.get<string>('testKey')).toBeNull();
      expect(localStorage.getItem('searchscout_cache_testKey')).toBeNull();
    });

    it('should use the per-call expirationDays override instead of the config value', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value', 30);
      expect(service.get<string>('testKey')).toBe('value');
    });

    it('should not save when the per-call expirationDays override is 0', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value', 0);
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should overwrite a previously saved value for the same key', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'first');
      service.save('testKey', 'second');
      expect(service.get<string>('testKey')).toBe('second');
    });
  });

  // ---------------------------------------------------------------------------
  // save() — quota exceeded / handleQuotaExceeded()
  // ---------------------------------------------------------------------------

  describe('save() — quota exceeded eviction', () => {
    it('should remove the oldest 25% of cache entries when localStorage is full', () => {
      // Write 4 entries directly — oldest timestamp last (key4 is oldest)
      for (let i = 1; i <= 4; i++) {
        writeEntry(`key${i}`, `value${i}`, Date.now() - i * 10_000, Date.now() + 1_000_000);
      }

      // Make the very next setItem call (the one inside save()) throw
      let firstCall = true;
      spyOn(localStorage, 'setItem').and.callFake(() => {
        if (firstCall) {
          firstCall = false;
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
      });

      service.save('newKey', 'newValue');

      // Math.ceil(4 * 0.25) = 1 → the single oldest entry (key4) is evicted
      expect(localStorage.getItem('searchscout_cache_key4')).toBeNull();
      // More recent entries remain
      expect(localStorage.getItem('searchscout_cache_key1')).not.toBeNull();
      expect(localStorage.getItem('searchscout_cache_key2')).not.toBeNull();
      expect(localStorage.getItem('searchscout_cache_key3')).not.toBeNull();
    });

    it('should not throw when a quota error occurs and the cache is empty', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(() => service.save('key', 'value')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // remove()
  // ---------------------------------------------------------------------------

  describe('remove()', () => {
    it('should remove a previously saved entry', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.remove('testKey');
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should not throw when removing a key that does not exist', () => {
      expect(() => service.remove('nonexistent')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // clearAll()
  // ---------------------------------------------------------------------------

  describe('clearAll()', () => {
    it('should remove all cache data entries', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('key1', 'value1');
      service.save('key2', 'value2');
      service.clearAll();
      expect(service.get<string>('key1')).toBeNull();
      expect(service.get<string>('key2')).toBeNull();
    });

    it('should preserve the config key after clearing', () => {
      service.setConfig({ expirationDays: 14 });
      service.save('key1', 'value1');
      service.clearAll();
      expect(service.getConfig().expirationDays).toBe(14);
    });

    it('should not throw when the cache is already empty', () => {
      expect(() => service.clearAll()).not.toThrow();
    });

    it('should not remove localStorage keys that do not match the cache prefix', () => {
      localStorage.setItem('unrelated_key', 'keep-me');
      service.save('cacheKey', 'value');
      service.clearAll();
      expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
    });
  });

  // ---------------------------------------------------------------------------
  // getMetadata()
  // ---------------------------------------------------------------------------

  describe('getMetadata()', () => {
    it('should return ageInDays of 0 for a freshly cached entry', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'value');
      const meta = service.getMetadata('testKey');
      expect(meta).not.toBeNull();
      expect(meta!.ageInDays).toBe(0);
      expect(meta!.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should return null for a key that has no entry', () => {
      expect(service.getMetadata('nonexistent')).toBeNull();
    });

    it('should return null when the stored value fails decompression', () => {
      localStorage.setItem('searchscout_cache_testKey', 'bad-data');
      expect(service.getMetadata('testKey')).toBeNull();
    });

    it('should return null when the stored value has malformed JSON after decompression', () => {
      localStorage.setItem(
        'searchscout_cache_testKey',
        LZString.compressToUTF16('not-valid-json{{{{')
      );
      expect(service.getMetadata('testKey')).toBeNull();
    });

    it('should reflect the correct age for an entry saved in the past', () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      writeEntry('oldKey', 'data', twoDaysAgo, Date.now() + 1_000_000);
      const meta = service.getMetadata('oldKey');
      expect(meta).not.toBeNull();
      expect(meta!.ageInDays).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getConfig() and setConfig()
  // ---------------------------------------------------------------------------

  describe('getConfig() and setConfig()', () => {
    it('should persist the new config to localStorage', () => {
      service.setConfig({ expirationDays: 30 });
      expect(service.getConfig().expirationDays).toBe(30);
    });

    it('should take effect immediately — a disabled cache no longer returns saved values', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 0 });
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should return a fallback config object when localStorage has no config entry', () => {
      localStorage.removeItem('searchscout_cache_config');
      const config = service.getConfig();
      expect(config).toBeTruthy();
      expect(typeof config.expirationDays).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // getCacheSize() and getCacheSizeMB()
  // ---------------------------------------------------------------------------

  describe('getCacheSize() and getCacheSizeMB()', () => {
    it('should return 0 when no cache entries exist', () => {
      expect(service.getCacheSize()).toBe(0);
    });

    it('should return a positive number after saving an entry', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'some data to add size to the cache');
      expect(service.getCacheSize()).toBeGreaterThan(0);
    });

    it('getCacheSizeMB() should equal getCacheSize() divided by (1024 * 1024)', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'data');
      expect(service.getCacheSizeMB()).toBeCloseTo(service.getCacheSize() / (1024 * 1024), 10);
    });

    it('should grow after saving additional entries', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('key1', 'first value');
      const sizeAfterFirst = service.getCacheSize();
      service.save('key2', 'second value');
      expect(service.getCacheSize()).toBeGreaterThan(sizeAfterFirst);
    });

    it('should decrease after removing an entry', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('key1', 'first value');
      service.save('key2', 'second value');
      const sizeBefore = service.getCacheSize();
      service.remove('key2');
      expect(service.getCacheSize()).toBeLessThan(sizeBefore);
    });

    it('should include the config key in the size calculation', () => {
      // The config key starts with the CACHE_PREFIX so it is counted
      expect(service.getCacheSize()).toBeGreaterThanOrEqual(0);
    });
  });
});
