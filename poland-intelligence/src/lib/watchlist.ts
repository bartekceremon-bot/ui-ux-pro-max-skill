'use client';

/**
 * Watchlist po stronie przeglądarki (bez przechowywania danych osobowych na
 * serwerze). W wersji produkcyjnej te same struktury odwzorowuje schemat
 * Prisma (watchlists / change_events) – patrz prisma/schema.prisma.
 */
export interface WatchItem {
  kind: 'company' | 'territory' | 'address';
  id: string;
  label: string;
  href: string;
  snapshot: Record<string, string>;
  addedAt: string;
}

export interface ChangeEvent {
  itemId: string;
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  source: string;
}

const ITEMS_KEY = 'pi.watchlist.v1';
const EVENTS_KEY = 'pi.changes.v1';

export function readWatchlist(): WatchItem[] {
  return read<WatchItem[]>(ITEMS_KEY) ?? [];
}

export function readChanges(): ChangeEvent[] {
  return read<ChangeEvent[]>(EVENTS_KEY) ?? [];
}

export function addWatch(item: Omit<WatchItem, 'addedAt'>): WatchItem[] {
  const items = readWatchlist().filter((i) => i.id !== item.id);
  const next = [{ ...item, addedAt: new Date().toISOString() }, ...items];
  write(ITEMS_KEY, next);
  return next;
}

export function removeWatch(id: string): WatchItem[] {
  const next = readWatchlist().filter((i) => i.id !== id);
  write(ITEMS_KEY, next);
  return next;
}

export function isWatched(id: string): boolean {
  return readWatchlist().some((i) => i.id === id);
}

/** Porównuje nowy snapshot z zapisanym i rejestruje zmiany (old → new). */
export function detectChanges(id: string, snapshot: Record<string, string>, source: string): ChangeEvent[] {
  const items = readWatchlist();
  const item = items.find((i) => i.id === id);
  if (!item) return [];
  const events: ChangeEvent[] = [];
  for (const [field, newValue] of Object.entries(snapshot)) {
    const oldValue = item.snapshot[field];
    if (oldValue !== undefined && oldValue !== newValue) {
      events.push({ itemId: id, field, oldValue, newValue, timestamp: new Date().toISOString(), source });
    }
  }
  if (events.length) {
    item.snapshot = { ...item.snapshot, ...snapshot };
    write(ITEMS_KEY, items);
    write(EVENTS_KEY, [...events, ...readChanges()].slice(0, 200));
  }
  return events;
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode – watchlist pozostaje w pamięci sesji */
  }
}
