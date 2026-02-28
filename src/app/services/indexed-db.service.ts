import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

type StoreName = 'keyvalue' | 'cache';

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB('searchscout', 1, {
      upgrade(db) {
        db.createObjectStore('keyvalue');
        db.createObjectStore('cache');
      }
    });
  }

  async get(store: StoreName, key: string): Promise<any> {
    const db = await this.dbPromise;
    return db.get(store, key);
  }

  async set(store: StoreName, key: string, value: any): Promise<void> {
    const db = await this.dbPromise;
    await db.put(store, value, key);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(store, key);
  }

  async getAll(store: StoreName): Promise<{ key: string; value: any }[]> {
    const db = await this.dbPromise;
    const tx = db.transaction(store);
    const keys = await tx.store.getAllKeys();
    const values = await tx.store.getAll();
    return (keys as string[]).map((key, i) => ({ key, value: values[i] }));
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(store);
  }
}
