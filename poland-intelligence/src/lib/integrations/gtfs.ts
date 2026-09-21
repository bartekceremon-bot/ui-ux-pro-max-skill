import { fetchSourced } from '../http';

export interface TransitFeed {
  city: string;
  agency: string;
  gtfsUrl: string | null;
  gtfsRtUrl: string | null;
  active: boolean;
  updatedAt: string;
  notes?: string;
}

/**
 * Konfiguracja feedów – aplikacja nie jest zakodowana pod jedno miasto.
 * Miasto bez zweryfikowanego feedu ma active:false i wyświetla "Brak aktywnego feedu".
 */
export const TRANSIT_FEEDS: TransitFeed[] = [
  { city: 'Warszawa', agency: 'ZTM Warszawa', gtfsUrl: 'https://mkuran.pl/gtfs/warsaw.zip', gtfsRtUrl: null, active: true, updatedAt: '2026-09-21', notes: 'Feed społecznościowy na bazie danych ZTM.' },
  { city: 'Kraków', agency: 'ZTP Kraków', gtfsUrl: 'https://gtfs.ztp.krakow.pl/GTFS_KRK_A.zip', gtfsRtUrl: 'https://gtfs.ztp.krakow.pl/VehiclePositions_A.pb', active: true, updatedAt: '2026-09-21', notes: 'Autobusy (A). Tramwaje: GTFS_KRK_T.zip.' },
  { city: 'Gdańsk', agency: 'ZTM Gdańsk', gtfsUrl: 'https://ckan.multimediagdansk.pl/dataset/c24aa637-3619-4dc2-a171-a23eec8f2172/resource/30e783e4-2bec-4a7d-bb22-ee3e0a26e6d1/download/gtfsgoogle.zip', gtfsRtUrl: null, active: true, updatedAt: '2026-09-21' },
  { city: 'Gdynia', agency: 'ZKM Gdynia', gtfsUrl: null, gtfsRtUrl: null, active: false, updatedAt: '2026-09-21', notes: 'Brak zweryfikowanego adresu feedu.' },
  { city: 'Poznań', agency: 'ZTM Poznań', gtfsUrl: null, gtfsRtUrl: null, active: false, updatedAt: '2026-09-21', notes: 'Dane publikowane przez Poznań Open Data – wymaga weryfikacji adresu.' },
  { city: 'Wrocław', agency: 'MPK Wrocław', gtfsUrl: null, gtfsRtUrl: null, active: false, updatedAt: '2026-09-21', notes: 'Wymaga weryfikacji adresu w Otwartym Wrocławiu.' },
  { city: 'Katowice', agency: 'ZTM GZM', gtfsUrl: null, gtfsRtUrl: null, active: false, updatedAt: '2026-09-21', notes: 'Otwarte dane ZTM GZM – wymaga weryfikacji.' },
  { city: 'Łódź', agency: 'MPK Łódź', gtfsUrl: null, gtfsRtUrl: null, active: false, updatedAt: '2026-09-21', notes: 'Wymaga weryfikacji adresu feedu.' },
];

export function feedFor(city: string): TransitFeed | null {
  return TRANSIT_FEEDS.find((f) => f.city.toLowerCase() === city.toLowerCase()) ?? null;
}

/** Sprawdza dostępność pliku GTFS bez pobierania całego archiwum. */
export async function probeFeed(city: string) {
  const feed = feedFor(city);
  if (!feed || !feed.active || !feed.gtfsUrl) {
    return {
      ok: false as const, data: null,
      error: 'Brak aktywnego feedu',
      provenance: {
        source: 'GTFS', sourceUrl: 'https://gtfs.org/schedule/reference/',
        retrievedAt: new Date().toISOString(), sourceUpdatedAt: null, recordId: city,
        freshness: 'LIVE' as const, quality: 'OFFICIAL' as const,
        note: feed?.notes ?? 'Miasto nieskonfigurowane.',
      },
    };
  }
  return fetchSourced<string>(feed.gtfsUrl, {
    connectorId: 'gtfs', source: `GTFS – ${feed.agency}`, sourceUrl: feed.gtfsUrl,
    ttlSeconds: 3600, accept: 'application/octet-stream', method: 'GET',
    recordId: city, timeoutMs: 8000,
  });
}

export async function healthCheck() {
  const active = TRANSIT_FEEDS.filter((f) => f.active).length;
  return {
    ok: active > 0,
    data: { activeFeeds: active, totalFeeds: TRANSIT_FEEDS.length },
    provenance: {
      source: 'GTFS (konfiguracja feedów)', sourceUrl: 'https://gtfs.org/schedule/reference/',
      retrievedAt: new Date().toISOString(), sourceUpdatedAt: null, recordId: null,
      freshness: 'LIVE' as const, quality: 'OFFICIAL' as const,
    },
  };
}
