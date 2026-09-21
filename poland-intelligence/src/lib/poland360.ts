import * as bdl from './integrations/bdl';
import * as gios from './integrations/gios';
import * as nfz from './integrations/nfz';
import * as openmeteo from './integrations/openmeteo';
import * as osm from './integrations/osm';
import * as nbp from './integrations/nbp';
import * as danegov from './integrations/danegov';
import { TRANSIT_FEEDS } from './integrations/gtfs';
import type { Provenance } from './types';

export interface Section<T = unknown> {
  id: string;
  title: string;
  ok: boolean;
  data: T | null;
  error?: string;
  provenance: Provenance;
}

export interface Poland360 {
  place: { name: string; lat: number; lon: number; unitId: string | null };
  sections: Section[];
  generatedAt: string;
}

/** Jeden panel analityczny łączący wszystkie źródła dla wskazanego miejsca. */
export async function poland360(opts: {
  name: string; lat: number; lon: number; unitId?: string | null; radiusMeters?: number;
}): Promise<Poland360> {
  const { name, lat, lon, unitId = null, radiusMeters = 5000 } = opts;
  const sections: Section[] = [];

  if (unitId) {
    for (const v of bdl.BDL_VARIABLES) {
      const res = await bdl.variableForUnit(v.variableId, unitId, 10);
      const values = res.data?.results?.[0]?.values ?? null;
      sections.push({
        id: `bdl-${v.key}`, title: `${v.group}: ${v.label} [${v.unit}]`,
        ok: res.ok && Boolean(values), data: values, error: res.error, provenance: res.provenance,
      });
    }
  }

  const air = await nearestAirStation(lat, lon);
  sections.push(air);

  const weather = await openmeteo.forecast(lat, lon);
  sections.push({ id: 'weather', title: 'Pogoda (Open-Meteo)', ok: weather.ok, data: weather.data, error: weather.error, provenance: weather.provenance });

  const health = await nfz.providers({ place: name.toUpperCase() });
  sections.push({ id: 'healthcare', title: 'Świadczeniodawcy NFZ', ok: health.ok, data: health.data?.data ?? null, error: health.error, provenance: health.provenance });

  const pois = await osm.poiAround(lat, lon, radiusMeters, 'szkoly');
  sections.push({ id: 'osm-schools', title: `Szkoły w promieniu ${radiusMeters / 1000} km (OSM)`, ok: pois.ok, data: pois.data?.elements ?? null, error: pois.error, provenance: pois.provenance });

  const currency = await nbp.series('EUR', 30);
  sections.push({ id: 'nbp-eur', title: 'EUR/PLN – 30 dni (NBP)', ok: currency.ok, data: currency.data, error: currency.error, provenance: currency.provenance });

  const datasets = await danegov.searchDatasets(name);
  sections.push({ id: 'datasets', title: `Zbiory danych publicznych dla „${name}”`, ok: datasets.ok, data: datasets.data?.data ?? null, error: datasets.error, provenance: datasets.provenance });

  const feed = TRANSIT_FEEDS.find((f) => f.city.toLowerCase() === name.toLowerCase()) ?? null;
  sections.push({
    id: 'transport', title: 'Transport publiczny (GTFS)',
    ok: Boolean(feed?.active), data: feed,
    error: feed?.active ? undefined : 'Brak aktywnego feedu',
    provenance: {
      source: 'GTFS (konfiguracja feedów)', sourceUrl: 'https://gtfs.org/schedule/reference/',
      retrievedAt: new Date().toISOString(), sourceUpdatedAt: feed?.updatedAt ?? null,
      recordId: feed?.city ?? null, freshness: 'LIVE', quality: 'OFFICIAL',
    },
  });

  return { place: { name, lat, lon, unitId }, sections, generatedAt: new Date().toISOString() };
}

export async function nearestAirStation(lat: number, lon: number): Promise<Section> {
  const st = await gios.stations();
  if (!st.ok || !st.data?.length) {
    return { id: 'air', title: 'Jakość powietrza (GIOŚ)', ok: false, data: null, error: st.error ?? 'Brak stacji', provenance: st.provenance };
  }
  const nearest = st.data
    .map((s) => ({ s, d: haversine(lat, lon, Number(s.gegrLat), Number(s.gegrLon)) }))
    .filter((x) => Number.isFinite(x.d))
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest) {
    return { id: 'air', title: 'Jakość powietrza (GIOŚ)', ok: false, data: null, error: 'Brak stacji w zasięgu', provenance: st.provenance };
  }
  const index = await gios.airIndex(nearest.s.id);
  return {
    id: 'air',
    title: `Jakość powietrza – stacja ${nearest.s.stationName} (${nearest.d.toFixed(1)} km)`,
    ok: index.ok,
    data: { station: nearest.s, distanceKm: Number(nearest.d.toFixed(2)), index: index.data },
    error: index.error,
    provenance: index.provenance,
  };
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
