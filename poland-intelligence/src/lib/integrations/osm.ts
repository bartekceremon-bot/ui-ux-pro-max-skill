import { fetchSourced } from '../http';
import { source } from '../sources';

const NOMINATIM = () => process.env.OSM_NOMINATIM_URL || source('osm').apiBase;
const OVERPASS = () => process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

export interface GeocodeResult {
  place_id: number; lat: string; lon: string; display_name: string;
  type: string; class: string; address?: Record<string, string>;
  boundingbox?: string[];
}

/** Public Nominatim: cached hard, one request at a time, never bulk. */
export async function geocode(q: string, limit = 5) {
  const url = `${NOMINATIM()}/search?q=${encodeURIComponent(q)}&countrycodes=pl&format=jsonv2&addressdetails=1&limit=${limit}`;
  return fetchSourced<GeocodeResult[]>(url, {
    connectorId: 'osm', source: 'OpenStreetMap / Nominatim', sourceUrl: url,
    quality: 'COMMUNITY', ttlSeconds: 24 * 3600, recordId: q,
  });
}

export async function reverse(lat: number, lon: number) {
  const url = `${NOMINATIM()}/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1`;
  return fetchSourced<GeocodeResult>(url, {
    connectorId: 'osm', source: 'OpenStreetMap / Nominatim (reverse)', sourceUrl: url,
    quality: 'COMMUNITY', ttlSeconds: 24 * 3600,
  });
}

export const POI_PRESETS: Record<string, string> = {
  szkoly: 'nwr["amenity"="school"]',
  szpitale: 'nwr["amenity"="hospital"]',
  przychodnie: 'nwr["amenity"="clinic"]',
  apteki: 'nwr["amenity"="pharmacy"]',
  stacje_paliw: 'nwr["amenity"="fuel"]',
  bankomaty: 'nwr["amenity"="atm"]',
  parkingi: 'nwr["amenity"="parking"]',
  restauracje: 'nwr["amenity"="restaurant"]',
  sklepy: 'nwr["shop"]',
  przystanki: 'nwr["highway"="bus_stop"]',
  stacje_kolejowe: 'nwr["railway"="station"]',
  przedszkola: 'nwr["amenity"="kindergarten"]',
};

export interface OverpassElement {
  type: string; id: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function poiAround(lat: number, lon: number, radiusMeters: number, preset: string) {
  const selector = POI_PRESETS[preset];
  if (!selector) {
    return {
      ok: false as const, data: null,
      error: `Nieznana kategoria POI: ${preset}. Dostępne: ${Object.keys(POI_PRESETS).join(', ')}`,
      provenance: {
        source: 'OpenStreetMap / Overpass', sourceUrl: OVERPASS(), retrievedAt: new Date().toISOString(),
        sourceUpdatedAt: null, recordId: null, freshness: 'LIVE' as const, quality: 'COMMUNITY' as const,
      },
    };
  }
  const radius = Math.min(Math.max(radiusMeters, 100), 20000);
  const query = `[out:json][timeout:25];(${selector}(around:${radius},${lat},${lon}););out center 300;`;
  return fetchSourced<{ elements: OverpassElement[] }>(OVERPASS(), {
    connectorId: 'osm', source: 'OpenStreetMap / Overpass API', sourceUrl: OVERPASS(),
    quality: 'COMMUNITY', ttlSeconds: 6 * 3600, method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    recordId: `${preset}@${lat.toFixed(3)},${lon.toFixed(3)},${radius}`,
    timeoutMs: 30000,
  });
}

export async function healthCheck() {
  return geocode('Warszawa', 1);
}
