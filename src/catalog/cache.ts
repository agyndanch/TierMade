import type { CatalogAdapter, CatalogResult } from "./types";

/** Tiny in-memory TTL + LRU cache used to protect upstream rate limits. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly ttlMs = 10 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // refresh recency
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear() {
    this.store.clear();
  }
}

/** Wraps an adapter so repeated searches / lookups hit memory first. */

export function withCache(adapter: CatalogAdapter, namespace: string): CatalogAdapter {
  const searches = new TtlCache<CatalogResult[]>();
  const items = new TtlCache<CatalogResult | null>(1000, 60 * 60 * 1000);
  return {
    source: adapter.source,
    async search(query, limit = 20) {
      const key = `${namespace}:${limit}:${query.trim().toLowerCase()}`;
      const cached = searches.get(key);
      if (cached) return cached;
      const results = await adapter.search(query, limit);
      searches.set(key, results);
      // Seed the item cache so "add to list" right after a search is free.
      for (const r of results) items.set(`${namespace}:${r.externalId}`, r);
      return results;
    },
    async getItem(externalId) {
      const key = `${namespace}:${externalId}`;
      const cached = items.get(key);
      if (cached !== undefined) return cached;
      const item = await adapter.getItem(externalId);
      if (item) items.set(key, item);
      return item;
    },
  };
}
