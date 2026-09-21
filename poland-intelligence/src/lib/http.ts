import { cacheGet, cacheSet } from './cache';
import { recordError, recordSuccess } from './health';
import type { Provenance, SourcedResult, SourceQuality } from './types';

export interface FetchOptions {
  connectorId: string;
  source: string;
  sourceUrl: string;
  quality?: SourceQuality;
  ttlSeconds?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  recordId?: string | null;
  accept?: string;
  timeoutMs?: number;
}

const UA = 'PolandIntelligence/1.0 (public-data research; +https://github.com/poland-intelligence)';

/**
 * Single entry point for every outbound call. Handles cache, timeouts,
 * health accounting and – most importantly – provenance. A failed call never
 * invents data: it either returns a clearly labelled CACHED copy or ok:false.
 */
export async function fetchSourced<T>(url: string, opts: FetchOptions): Promise<SourcedResult<T>> {
  const {
    connectorId, source, sourceUrl, quality = 'OFFICIAL', ttlSeconds = 900,
    headers = {}, method = 'GET', body, recordId = null, accept = 'application/json',
    timeoutMs = 15000,
  } = opts;

  const cacheKey = `${connectorId}:${method}:${url}:${body ?? ''}`;
  const fresh = cacheGet<T>(cacheKey);
  if (fresh) {
    return {
      ok: true,
      data: fresh.value,
      provenance: prov({ source, sourceUrl, recordId, freshness: 'CACHED', quality, retrievedAt: fresh.storedAt }),
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: accept, ...headers },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const sourceUpdatedAt = res.headers.get('last-modified');
    const payload = (accept.includes('json') ? await res.json() : await res.text()) as T;
    cacheSet(cacheKey, payload, ttlSeconds);
    recordSuccess(connectorId, Date.now() - started);
    return {
      ok: true,
      data: payload,
      provenance: prov({
        source, sourceUrl, recordId, freshness: 'LIVE', quality,
        retrievedAt: new Date().toISOString(),
        sourceUpdatedAt: sourceUpdatedAt ? new Date(sourceUpdatedAt).toISOString() : null,
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordError(connectorId, message);
    const stale = cacheGet<T>(cacheKey, { allowStale: true });
    if (stale) {
      return {
        ok: true,
        data: stale.value,
        error: `Źródło chwilowo niedostępne (${message}) – pokazano kopię CACHE.`,
        provenance: prov({
          source, sourceUrl, recordId, freshness: 'CACHED', quality,
          retrievedAt: stale.storedAt, note: 'Źródło chwilowo niedostępne – dane z cache.',
        }),
      };
    }
    return {
      ok: false,
      data: null,
      error: `Źródło chwilowo niedostępne: ${message}`,
      provenance: prov({
        source, sourceUrl, recordId, freshness: 'LIVE', quality,
        retrievedAt: new Date().toISOString(), note: 'Brak danych – źródło nie odpowiedziało.',
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

function prov(p: Partial<Provenance> & Pick<Provenance, 'source' | 'sourceUrl' | 'retrievedAt'>): Provenance {
  return {
    source: p.source,
    sourceUrl: p.sourceUrl,
    retrievedAt: p.retrievedAt,
    sourceUpdatedAt: p.sourceUpdatedAt ?? null,
    recordId: p.recordId ?? null,
    freshness: p.freshness ?? 'LIVE',
    quality: p.quality ?? 'OFFICIAL',
    note: p.note,
  };
}

export function unconfigured<T>(source: string, sourceUrl: string, what: string): SourcedResult<T> {
  return {
    ok: false,
    data: null,
    error: `Brak konfiguracji: ${what}. Uzupełnij zmienne środowiskowe (.env).`,
    provenance: {
      source, sourceUrl, retrievedAt: new Date().toISOString(), sourceUpdatedAt: null,
      recordId: null, freshness: 'LIVE', quality: 'OFFICIAL',
      note: 'Connector nieskonfigurowany – brak danych (nie generujemy zastępczych).',
    },
  };
}
