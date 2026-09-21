export type Freshness = 'LIVE' | 'RECENT' | 'CACHED' | 'HISTORICAL';
export type SourceQuality = 'OFFICIAL' | 'COMMUNITY' | 'DERIVED';
export type SourceStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNCONFIGURED';

/** Provenance attached to EVERY value the app displays. */
export interface Provenance {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  sourceUpdatedAt?: string | null;
  recordId?: string | null;
  freshness: Freshness;
  quality: SourceQuality;
  note?: string;
}

export interface SourcedResult<T> {
  ok: boolean;
  data: T | null;
  provenance: Provenance;
  error?: string;
}

export interface Entity {
  entityId: string;
  name: string;
  nip?: string | null;
  regon?: string | null;
  krs?: string | null;
  legalForm?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  voivodeship?: string | null;
  county?: string | null;
  municipality?: string | null;
  pkd?: string[] | null;
  status?: string | null;
  source: string;
  sourceTimestamp: string;
}

export interface Territory {
  terytCode: string;
  name: string;
  type: 'voivodeship' | 'county' | 'municipality' | 'locality';
  parentTerritory?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export type QueryKind =
  | 'nip' | 'regon' | 'krs' | 'postal_code' | 'coordinates'
  | 'teryt' | 'address' | 'place' | 'company_name';

export interface DetectedQuery {
  kind: QueryKind;
  value: string;
  normalized: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}
