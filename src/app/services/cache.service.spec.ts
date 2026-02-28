import { TestBed } from '@angular/core/testing';

import { CacheService } from './cache.service';
import { IndexedDbService } from './indexed-db.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockDb: jasmine.SpyObj<IndexedDbService>;

  beforeEach(async () => {
    mockDb = jasmine.createSpyObj('IndexedDbService', ['get', 'set', 'delete', 'getAll', 'clear']);
    mockDb.getAll.and.resolveTo([]);
    mockDb.set.and.resolveTo(undefined);
    mockDb.delete.and.resolveTo(undefined);
    mockDb.get.and.resolveTo(undefined);
    mockDb.clear.and.resolveTo(undefined);

    TestBed.configureTestingModule({
      providers: [{ provide: IndexedDbService, useValue: mockDb }]
    });
    service = TestBed.inject(CacheService);
    await service.initialize();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // initialize()
  // ---------------------------------------------------------------------------

  describe('initialize()', () => {
    it('should load a valid (non-expired) cache entry from IDB', async () => {
      const future = Date.now() + 1_000_000;
      const entry = { key: 'myKey', data: { foo: 'bar' }, timestamp: Date.now(), expiresAt: future };
      mockDb.getAll.and.callFake((store: string) =>
        store === 'cache'
          ? Promise.resolve([{ key: 'myKey', value: entry }])
          : Promise.resolve([])
      );
      mockDb.get.and.resolveTo(undefined);

      const freshService = new CacheService(mockDb);
      await freshService.initialize();
      freshService.setConfig({ expirationDays: 7 });

      expect(freshService.get<{ foo: string }>('myKey')).toEqual({ foo: 'bar' });
    });

    it('should evict expired entries from IDB during initialize', async () => {
      const past = Date.now() - 1_000;
      const entry = { key: 'expiredKey', data: 'old', timestamp: Date.now() - 10_000, expiresAt: past };
      mockDb.getAll.and.callFake((store: string) =>
        store === 'cache'
          ? Promise.resolve([{ key: 'expiredKey', value: entry }])
          : Promise.resolve([])
      );
      mockDb.get.and.resolveTo(undefined);

      const freshService = new CacheService(mockDb);
      await freshService.initialize();
      freshService.setConfig({ expirationDays: 7 });

      expect(freshService.get<string>('expiredKey')).toBeNull();
      expect(mockDb.delete).toHaveBeenCalledWith('cache', 'expiredKey');
    });

    it('should load config from IDB on initialize', async () => {
      mockDb.getAll.and.resolveTo([]);
      mockDb.get.and.resolveTo({ expirationDays: 14 });

      const freshService = new CacheService(mockDb);
      await freshService.initialize();

      expect(freshService.getConfig().expirationDays).toBe(14);
    });

    it('should use the environment default config when IDB has no stored config', async () => {
      mockDb.getAll.and.resolveTo([]);
      mockDb.get.and.resolveTo(undefined);

      const freshService = new CacheService(mockDb);
      await freshService.initialize();

      expect(typeof freshService.getConfig().expirationDays).toBe('number');
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

    it('should not save when expirationDays config is 0', () => {
      service.setConfig({ expirationDays: 0 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 7 });
      expect(service.get<string>('testKey')).toBeNull();
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
      service.save('testKey', { value: 42 });
      // Manually expire the in-memory entry
      (service as any).memoryCache.get('testKey').expiresAt = Date.now() - 1_000;
      expect(service.get<{ value: number }>('testKey')).toBeNull();
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

    it('should preserve the config after clearing', () => {
      service.setConfig({ expirationDays: 14 });
      service.save('key1', 'value1');
      service.clearAll();
      expect(service.getConfig().expirationDays).toBe(14);
    });

    it('should not throw when the cache is already empty', () => {
      expect(() => service.clearAll()).not.toThrow();
    });

    it('should call db.clear with the cache store', () => {
      service.clearAll();
      expect(mockDb.clear).toHaveBeenCalledWith('cache');
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

    it('should reflect the correct age for an entry saved in the past', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('oldKey', 'data');
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      (service as any).memoryCache.get('oldKey').timestamp = twoDaysAgo;
      const meta = service.getMetadata('oldKey');
      expect(meta).not.toBeNull();
      expect(meta!.ageInDays).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getConfig() and setConfig()
  // ---------------------------------------------------------------------------

  describe('getConfig() and setConfig()', () => {
    it('should update and return the new config', () => {
      service.setConfig({ expirationDays: 30 });
      expect(service.getConfig().expirationDays).toBe(30);
    });

    it('should take effect immediately — a disabled cache no longer returns saved values', () => {
      service.setConfig({ expirationDays: 7 });
      service.save('testKey', 'hello');
      service.setConfig({ expirationDays: 0 });
      expect(service.get<string>('testKey')).toBeNull();
    });

    it('should persist config to IDB via db.set', () => {
      service.setConfig({ expirationDays: 30 });
      expect(mockDb.set).toHaveBeenCalledWith('keyvalue', 'cache_config', { expirationDays: 30 });
    });

    it('should return a default config when initialized without stored config', async () => {
      mockDb.get.and.resolveTo(undefined);
      const freshService = new CacheService(mockDb);
      await freshService.initialize();
      expect(typeof freshService.getConfig().expirationDays).toBe('number');
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
  });
});
