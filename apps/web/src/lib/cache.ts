/**
 * In-memory SWR cache for API GET requests.
 * - Returns stale data immediately on repeat visits (instant UI)
 * - Triggers a background revalidation so data stays fresh
 * - Invalidated automatically on mutations (POST/PUT/DELETE)
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const STALE_MS = 30_000; // data older than 30s triggers background refetch
const MAX_AGE_MS = 5 * 60_000; // never serve data older than 5 min

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > MAX_AGE_MS) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function cacheIsStale(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > STALE_MS;
}

/** Returns true if there is ANY (even stale) cached entry for this key */
export function cacheHas(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() - entry.fetchedAt > MAX_AGE_MS) {
    store.delete(key);
    return false;
  }
  return true;
}

export function cacheInvalidate(pattern: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}
