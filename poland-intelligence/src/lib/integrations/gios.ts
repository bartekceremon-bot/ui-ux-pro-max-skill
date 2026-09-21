import { fetchSourced } from '../http';
import { source } from '../sources';

/** GIOŚ API v1 (/pjp-api/v1/rest/...). The pre-v1 endpoints are retired. */
const S = () => source('gios');

export interface GiosStation {
  id: number; stationName: string; gegrLat: string; gegrLon: string;
  city?: { name?: string } | null;
}

interface V1Envelope<T> { [key: string]: T[] | unknown }

export async function stations() {
  const s = S();
  const url = `${s.apiBase}/station/findAll?size=500`;
  const r = await fetchSourced<V1Envelope<Record<string, unknown>>>(url, {
    connectorId: 'gios', source: 'GIOŚ – stacje pomiarowe', sourceUrl: url, ttlSeconds: 6 * 3600,
  });
  if (!r.ok || !r.data) return { ...r, data: null as GiosStation[] | null };
  return { ...r, data: normalizeStations(r.data) };
}

export function normalizeStations(payload: unknown): GiosStation[] {
  const rows = extractRows(payload);
  return rows
    .map((row) => ({
      id: Number(pick(row, ['id', 'Identyfikator stacji'])),
      stationName: String(pick(row, ['stationName', 'Nazwa stacji']) ?? ''),
      gegrLat: String(pick(row, ['gegrLat', 'WGS84 φ N']) ?? ''),
      gegrLon: String(pick(row, ['gegrLon', 'WGS84 λ E']) ?? ''),
      city: { name: String(pick(row, ['Nazwa miasta']) ?? '') || undefined },
    }))
    .filter((s) => Number.isFinite(s.id) && s.gegrLat && s.gegrLon);
}

export async function sensors(stationId: number) {
  const s = S();
  const url = `${s.apiBase}/station/sensors/${stationId}`;
  return fetchSourced<unknown>(url, {
    connectorId: 'gios', source: 'GIOŚ – stanowiska', sourceUrl: url, ttlSeconds: 6 * 3600,
    recordId: String(stationId),
  });
}

export async function measurements(sensorId: number) {
  const s = S();
  const url = `${s.apiBase}/data/getData/${sensorId}`;
  return fetchSourced<unknown>(url, {
    connectorId: 'gios', source: 'GIOŚ – pomiary', sourceUrl: url, ttlSeconds: 900,
    recordId: String(sensorId),
  });
}

export async function airIndex(stationId: number) {
  const s = S();
  const url = `${s.apiBase}/aqindex/getIndex/${stationId}`;
  return fetchSourced<unknown>(url, {
    connectorId: 'gios', source: 'GIOŚ – indeks jakości powietrza', sourceUrl: url, ttlSeconds: 1800,
    recordId: String(stationId),
  });
}

export function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object') {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as Record<string, unknown>[];
    }
  }
  return [];
}

export function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (row[k] !== undefined) return row[k];
  return undefined;
}

export async function healthCheck() {
  return stations();
}
