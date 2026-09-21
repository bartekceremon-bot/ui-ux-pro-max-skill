/**
 * Cache with a Redis-compatible shape but an in-process default, so the app
 * runs with zero infrastructure. Every hit is tagged so the UI can label data
 * as CACHED instead of pretending it is live.
 */
type Entry = { value: unknown; storedAt: number; expiresAt: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 2000;

export interface CacheHit<T> {
  value: T;
  storedAt: string;
  stale: boolean;
}

export function cacheGet<T>(key: string, opts: { allowStale?: boolean } = {}): CacheHit<T> | null {
  const e = store.get(key);
  if (!e) return null;
  const stale = Date.now() > e.expiresAt;
  if (stale && !opts.allowStale) return null;
  return { value: e.value as T, storedAt: new Date(e.storedAt).toISOString(), stale };
}

export function cacheSet(key: string, value: unknown, ttlSeconds: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
  const now = Date.now();
  store.set(key, { value, storedAt: now, expiresAt: now + ttlSeconds * 1000 });
}

export function cacheStats() {
  return { entries: store.size, max: MAX_ENTRIES };
}
