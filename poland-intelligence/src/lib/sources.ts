import { registerConnector } from './health';

export interface SourceDef {
  id: string;
  label: string;
  homepage: string;
  apiBase: string;
  requiresKey: boolean;
  keyEnv?: string;
  docs: string;
  quality: 'OFFICIAL' | 'COMMUNITY';
}

/** Endpoints are configuration, never hard-coded call sites. */
export const SOURCES: SourceDef[] = [
  { id: 'krs', label: 'KRS', homepage: 'https://prs.ms.gov.pl/krs', apiBase: env('KRS_API_URL', 'https://api-krs.ms.gov.pl/api/krs'), requiresKey: false, docs: 'https://prs.ms.gov.pl/krs/openApi', quality: 'OFFICIAL' },
  { id: 'ceidg', label: 'CEIDG', homepage: 'https://dane.biznes.gov.pl', apiBase: env('CEIDG_API_URL', 'https://dane.biznes.gov.pl/api/ceidg/v3'), requiresKey: true, keyEnv: 'CEIDG_JWT', docs: 'https://dane.biznes.gov.pl/api/ceidg/v3/swagger-ui.html', quality: 'OFFICIAL' },
  { id: 'regon', label: 'REGON / GUS', homepage: 'https://api.stat.gov.pl/Home/RegonApi', apiBase: env('REGON_API_URL', 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc'), requiresKey: true, keyEnv: 'GUS_REGON_KEY', docs: 'https://api.stat.gov.pl/Home/RegonApi', quality: 'OFFICIAL' },
  { id: 'teryt', label: 'TERYT', homepage: 'https://eteryt.stat.gov.pl', apiBase: env('TERYT_API_URL', 'https://api.stat.gov.pl/Home/TerytApi'), requiresKey: true, keyEnv: 'TERYT_USER', docs: 'https://api.stat.gov.pl/Home/TerytApi', quality: 'OFFICIAL' },
  { id: 'bdl', label: 'GUS BDL', homepage: 'https://bdl.stat.gov.pl', apiBase: env('BDL_API_URL', 'https://bdl.stat.gov.pl/api/v1'), requiresKey: false, keyEnv: 'GUS_CLIENT_ID', docs: 'https://api.stat.gov.pl/Home/BdlApi', quality: 'OFFICIAL' },
  { id: 'danegov', label: 'dane.gov.pl', homepage: 'https://dane.gov.pl', apiBase: env('DANEGOV_API_URL', 'https://api.dane.gov.pl/1.4'), requiresKey: false, docs: 'https://api.dane.gov.pl/doc', quality: 'OFFICIAL' },
  { id: 'nbp', label: 'NBP', homepage: 'https://nbp.pl', apiBase: env('NBP_API_URL', 'https://api.nbp.pl/api'), requiresKey: false, docs: 'https://api.nbp.pl/', quality: 'OFFICIAL' },
  { id: 'geoportal', label: 'Geoportal', homepage: 'https://www.geoportal.gov.pl', apiBase: env('GEOPORTAL_WMS_URL', 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution'), requiresKey: false, docs: 'https://www.geoportal.gov.pl/pl/dane/usluga-przegladania-wms/', quality: 'OFFICIAL' },
  { id: 'gios', label: 'GIOŚ', homepage: 'https://powietrze.gios.gov.pl', apiBase: env('GIOS_API_URL', 'https://api.gios.gov.pl/pjp-api/v1/rest'), requiresKey: false, docs: 'https://powietrze.gios.gov.pl/pjp/content/api', quality: 'OFFICIAL' },
  { id: 'nfz', label: 'NFZ', homepage: 'https://api.nfz.gov.pl', apiBase: env('NFZ_API_URL', 'https://api.nfz.gov.pl'), requiresKey: false, docs: 'https://api.nfz.gov.pl/app-umw-api', quality: 'OFFICIAL' },
  { id: 'gtfs', label: 'GTFS', homepage: 'https://gtfs.org', apiBase: env('GTFS_CONFIG_URL', 'local://transit-feeds'), requiresKey: false, docs: 'https://gtfs.org/schedule/reference/', quality: 'OFFICIAL' },
  { id: 'osm', label: 'OpenStreetMap', homepage: 'https://www.openstreetmap.org', apiBase: env('OSM_NOMINATIM_URL', 'https://nominatim.openstreetmap.org'), requiresKey: false, docs: 'https://nominatim.org/release-docs/latest/api/Overview/', quality: 'COMMUNITY' },
  { id: 'openmeteo', label: 'Open-Meteo', homepage: 'https://open-meteo.com', apiBase: env('OPENMETEO_URL', 'https://api.open-meteo.com/v1'), requiresKey: false, docs: 'https://open-meteo.com/en/docs', quality: 'OFFICIAL' },
];

for (const s of SOURCES) registerConnector(s.id, s.label);

export function source(id: string): SourceDef {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown source: ${id}`);
  return s;
}

export function hasKey(id: string): boolean {
  const s = source(id);
  if (!s.requiresKey) return true;
  return Boolean(s.keyEnv && process.env[s.keyEnv]);
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

/**
 * Geoportal services change endpoints; keep them in editable configuration
 * rather than scattered through the map code.
 */
export interface GeoportalSource {
  name: string;
  serviceType: 'WMS' | 'WMTS' | 'WFS' | 'WCS';
  url: string;
  layers?: string;
  active: boolean;
  lastVerified: string;
  notes: string;
}

export const GEOPORTAL_SOURCES: GeoportalSource[] = [
  { name: 'Ortofotomapa (standard)', serviceType: 'WMTS', url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution', layers: 'ORTOFOTOMAPA', active: true, lastVerified: '2026-09-21', notes: 'Publiczna usługa przeglądania PZGiK.' },
  { name: 'Granice administracyjne (PRG)', serviceType: 'WMS', url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WMS/AdministrativeBoundaries', layers: 'A03_Granice_wojewodztw,A04_Granice_powiatow,A05_Granice_gmin', active: true, lastVerified: '2026-09-21', notes: 'PRG – państwowy rejestr granic.' },
  { name: 'Punkty adresowe (PRG)', serviceType: 'WMS', url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WMS/AdressPoints', layers: 'PunktyAdresowe', active: true, lastVerified: '2026-09-21', notes: 'Punkty adresowe PRG.' },
  { name: 'Działki i budynki (KIEG)', serviceType: 'WMS', url: 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow', layers: 'dzialki,budynki', active: true, lastVerified: '2026-09-21', notes: 'Krajowa Integracja Ewidencji Gruntów – dostępność zależna od powiatu.' },
  { name: 'BDOT10k', serviceType: 'WMS', url: 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/BDOT/WMS/TopographicMap', active: false, lastVerified: '2026-09-21', notes: 'Wyłączone domyślnie – sprawdź aktualny endpoint przed włączeniem.' },
];
