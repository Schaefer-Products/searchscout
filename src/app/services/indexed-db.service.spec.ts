import { TestBed } from '@angular/core/testing';

import { IndexedDbService } from './indexed-db.service';

describe('IndexedDbService', () => {
  let service: IndexedDbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndexedDbService);
    await service.clear('keyvalue');
    await service.clear('cache');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── set() and get() ──────────────────────────────────────────────────────

  describe('set() and get()', () => {
    it('should store and retrieve an object from the keyvalue store', async () => {
      await service.set('keyvalue', 'myKey', { foo: 'bar' });
      expect(await service.get('keyvalue', 'myKey')).toEqual({ foo: 'bar' });
    });

    it('should store and retrieve an array from the cache store', async () => {
      await service.set('cache', 'cacheKey', [1, 2, 3]);
      expect(await service.get('cache', 'cacheKey')).toEqual([1, 2, 3]);
    });

    it('should return undefined for a key that does not exist', async () => {
      expect(await service.get('keyvalue', 'nonexistent')).toBeUndefined();
    });

    it('should overwrite an existing value for the same key', async () => {
      await service.set('keyvalue', 'key', 'first');
      await service.set('keyvalue', 'key', 'second');
      expect(await service.get('keyvalue', 'key')).toBe('second');
    });

    it('should store values independently per store', async () => {
      await service.set('keyvalue', 'shared', 'from-keyvalue');
      await service.set('cache', 'shared', 'from-cache');
      expect(await service.get('keyvalue', 'shared')).toBe('from-keyvalue');
      expect(await service.get('cache', 'shared')).toBe('from-cache');
    });
  });

  // ─── delete() ─────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should remove a previously set entry', async () => {
      await service.set('keyvalue', 'toDelete', 'value');
      await service.delete('keyvalue', 'toDelete');
      expect(await service.get('keyvalue', 'toDelete')).toBeUndefined();
    });

    it('should not throw when deleting a key that does not exist', async () => {
      await expectAsync(service.delete('keyvalue', 'nonexistent')).toBeResolved();
    });

    it('should only remove the specified key, leaving others intact', async () => {
      await service.set('keyvalue', 'keep', 'keeper');
      await service.set('keyvalue', 'remove', 'gone');
      await service.delete('keyvalue', 'remove');
      expect(await service.get('keyvalue', 'keep')).toBe('keeper');
      expect(await service.get('keyvalue', 'remove')).toBeUndefined();
    });
  });

  // ─── getAll() ─────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('should return an empty array when the store is empty', async () => {
      expect(await service.getAll('keyvalue')).toEqual([]);
    });

    it('should return all key-value pairs from the store', async () => {
      await service.set('keyvalue', 'a', 1);
      await service.set('keyvalue', 'b', 2);
      const result = await service.getAll('keyvalue');
      expect(result.length).toBe(2);
      expect(result).toContain(jasmine.objectContaining({ key: 'a', value: 1 }));
      expect(result).toContain(jasmine.objectContaining({ key: 'b', value: 2 }));
    });

    it('should return entries from the correct store only', async () => {
      await service.set('keyvalue', 'kvKey', 'kvVal');
      await service.set('cache', 'cacheKey', 'cacheVal');
      const kvEntries = await service.getAll('keyvalue');
      const cacheEntries = await service.getAll('cache');
      expect(kvEntries).toEqual([{ key: 'kvKey', value: 'kvVal' }]);
      expect(cacheEntries).toEqual([{ key: 'cacheKey', value: 'cacheVal' }]);
    });
  });

  // ─── clear() ──────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should remove all entries from the specified store', async () => {
      await service.set('keyvalue', 'k1', 'v1');
      await service.set('keyvalue', 'k2', 'v2');
      await service.clear('keyvalue');
      expect(await service.getAll('keyvalue')).toEqual([]);
    });

    it('should not affect the other store when clearing one', async () => {
      await service.set('keyvalue', 'kv', 'data');
      await service.set('cache', 'c', 'data');
      await service.clear('keyvalue');
      expect(await service.getAll('keyvalue')).toEqual([]);
      expect(await service.getAll('cache')).toHaveSize(1);
    });

    it('should not throw when clearing an already empty store', async () => {
      await expectAsync(service.clear('cache')).toBeResolved();
    });
  });
});
