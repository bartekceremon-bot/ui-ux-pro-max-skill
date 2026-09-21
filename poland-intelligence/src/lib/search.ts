import { detectQuery, RESOLUTION_PRIORITY } from './detect';
import * as krs from './integrations/krs';
import * as ceidg from './integrations/ceidg';
import * as regon from './integrations/regon';
import * as teryt from './integrations/teryt';
import * as osm from './integrations/osm';
import type { DetectedQuery, Entity, Provenance, Territory } from './types';

export interface Candidate {
  kind: 'company' | 'territory' | 'place';
  title: string;
  subtitle: string;
  href: string | null;
  identifiers: Record<string, string | null>;
  provenance: Provenance;
  matchedBy: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SearchResponse {
  query: string;
  detected: DetectedQuery[];
  candidates: Candidate[];
  issues: { source: string; message: string }[];
  /** Kandydaci nie są scalani automatycznie przy niejednoznacznym dopasowaniu. */
  merged: Entity | null;
  mergeNote: string;
}

export async function globalSearch(input: string): Promise<SearchResponse> {
  const detected = detectQuery(input)
    .sort((a, b) => (RESOLUTION_PRIORITY[b.kind] ?? 0) - (RESOLUTION_PRIORITY[a.kind] ?? 0));
  const candidates: Candidate[] = [];
  const issues: { source: string; message: string }[] = [];

  for (const d of detected.slice(0, 4)) {
    if (d.kind === 'krs') {
      const res = await krs.byKrs(d.normalized);
      if (res.ok && res.data) {
        const entity = krs.normalize(res.data, d.normalized);
        if (entity) candidates.push(companyCandidate(entity, res.provenance, 'numer KRS', 'HIGH'));
      } else if (res.error) issues.push({ source: 'KRS', message: res.error });
    }

    if (d.kind === 'nip' || d.kind === 'regon') {
      const res = await regon.searchBy(d.kind, d.normalized);
      if (res.ok && res.data?.length) {
        for (const row of res.data) candidates.push(regonCandidate(row, res.provenance, d.kind.toUpperCase()));
      } else if (res.error) issues.push({ source: 'REGON', message: res.error });

      const c = await ceidg.search(d.kind === 'nip' ? { nip: d.normalized } : { regon: d.normalized });
      if (c.ok && c.data?.firmy?.length) {
        for (const firma of c.data.firmy.slice(0, 10)) {
          candidates.push(companyCandidate(ceidg.normalize(firma), c.provenance, `CEIDG / ${d.kind.toUpperCase()}`, 'HIGH'));
        }
      } else if (c.error) issues.push({ source: 'CEIDG', message: c.error });
    }

    if (d.kind === 'company_name') {
      const c = await ceidg.search({ nazwa: d.normalized });
      if (c.ok && c.data?.firmy?.length) {
        for (const firma of c.data.firmy.slice(0, 10)) {
          candidates.push(companyCandidate(ceidg.normalize(firma), c.provenance, 'nazwa (CEIDG)', 'MEDIUM'));
        }
      } else if (c.error) issues.push({ source: 'CEIDG', message: c.error });
    }

    if (d.kind === 'place' || d.kind === 'teryt') {
      const t = d.kind === 'teryt' ? await teryt.get(d.normalized) : await teryt.search(stripPrefix(d.normalized));
      const rows: Territory[] = Array.isArray(t.data) ? t.data : t.data ? [t.data] : [];
      for (const row of rows.slice(0, 10)) {
        candidates.push({
          kind: 'territory',
          title: row.name,
          subtitle: `${typeLabel(row.type)} · TERYT/BDL ${row.terytCode}`,
          href: `/locations/${row.terytCode}`,
          identifiers: { teryt: row.terytCode },
          provenance: t.provenance,
          matchedBy: 'jednostka terytorialna (GUS BDL / TERYT)',
          confidence: d.confidence,
        });
      }
      if (!t.ok && t.error) issues.push({ source: 'GUS BDL / TERYT', message: t.error });
    }

    if (d.kind === 'address' || d.kind === 'postal_code' || d.kind === 'place') {
      const g = await osm.geocode(d.normalized, 5);
      if (g.ok && g.data?.length) {
        for (const hit of g.data) {
          candidates.push({
            kind: 'place',
            title: hit.display_name.split(',').slice(0, 3).join(','),
            subtitle: `${hit.class}/${hit.type} · ${Number(hit.lat).toFixed(5)}, ${Number(hit.lon).toFixed(5)}`,
            href: `/map?lat=${hit.lat}&lon=${hit.lon}&label=${encodeURIComponent(hit.display_name.split(',')[0])}`,
            identifiers: { osm_place_id: String(hit.place_id) },
            provenance: g.provenance,
            matchedBy: 'geokodowanie (Nominatim)',
            confidence: 'MEDIUM',
          });
        }
      } else if (g.error) issues.push({ source: 'OSM / Nominatim', message: g.error });
    }

    if (d.kind === 'coordinates') {
      const [lat, lon] = d.normalized.split(',').map(Number);
      const r = await osm.reverse(lat, lon);
      if (r.ok && r.data) {
        candidates.push({
          kind: 'place',
          title: r.data.display_name?.split(',').slice(0, 3).join(',') ?? `${lat}, ${lon}`,
          subtitle: `Reverse geocoding · ${lat}, ${lon}`,
          href: `/map?lat=${lat}&lon=${lon}`,
          identifiers: { lat: String(lat), lon: String(lon) },
          provenance: r.provenance,
          matchedBy: 'współrzędne',
          confidence: 'HIGH',
        });
      } else if (r.error) issues.push({ source: 'OSM / Nominatim', message: r.error });
    }
  }

  const { merged, mergeNote } = resolve(candidates);
  return { query: input, detected, candidates, issues, merged, mergeNote };
}

/** Scalamy tylko przy jednoznacznym identyfikatorze; inaczej pokazujemy kandydatów. */
function resolve(candidates: Candidate[]): { merged: Entity | null; mergeNote: string } {
  const companies = candidates.filter((c) => c.kind === 'company');
  if (companies.length === 0) return { merged: null, mergeNote: 'Brak kandydatów podmiotu gospodarczego.' };
  const strong = companies.filter((c) => c.confidence === 'HIGH');
  const keys = new Set(strong.map((c) => c.identifiers.nip || c.identifiers.krs || c.identifiers.regon || c.title));
  if (strong.length >= 1 && keys.size === 1) {
    const merged = strong.reduce<Entity>((acc, c) => ({
      ...acc,
      name: acc.name || c.title,
      nip: acc.nip ?? c.identifiers.nip ?? null,
      regon: acc.regon ?? c.identifiers.regon ?? null,
      krs: acc.krs ?? c.identifiers.krs ?? null,
      source: [acc.source, c.provenance.source].filter(Boolean).join(' + '),
    }), emptyEntity());
    return { merged, mergeNote: 'Scalono rekordy na podstawie jednoznacznego identyfikatora (NIP/REGON/KRS).' };
  }
  return {
    merged: null,
    mergeNote: 'Dopasowanie niejednoznaczne – rekordy NIE zostały scalone automatycznie. Wybierz kandydata.',
  };
}

function emptyEntity(): Entity {
  return {
    entityId: '', name: '', nip: null, regon: null, krs: null, legalForm: null,
    address: null, city: null, postalCode: null, voivodeship: null, county: null,
    municipality: null, pkd: null, status: null, source: '', sourceTimestamp: new Date().toISOString(),
  };
}

function companyCandidate(e: Entity, provenance: Provenance, matchedBy: string, confidence: Candidate['confidence']): Candidate {
  return {
    kind: 'company',
    title: e.name,
    subtitle: [e.legalForm, e.city, e.status].filter(Boolean).join(' · ') || '—',
    href: e.krs ? `/companies/${e.krs}` : null,
    identifiers: { nip: e.nip ?? null, regon: e.regon ?? null, krs: e.krs ?? null },
    provenance,
    matchedBy,
    confidence,
  };
}

function regonCandidate(row: Record<string, string>, provenance: Provenance, matchedBy: string): Candidate {
  const name = row.Nazwa ?? row.nazwa ?? '(bez nazwy)';
  return {
    kind: 'company',
    title: name,
    subtitle: [row.Miejscowosc, row.Wojewodztwo, row.Typ].filter(Boolean).join(' · ') || '—',
    href: row.KRS ? `/companies/${row.KRS}` : null,
    identifiers: { nip: row.Nip ?? null, regon: row.Regon ?? null, krs: row.KRS ?? null },
    provenance,
    matchedBy: `REGON / ${matchedBy}`,
    confidence: 'HIGH',
  };
}

function stripPrefix(s: string) {
  return s.replace(/^(gmina|powiat|województwo|woj\.)\s+/i, '').trim();
}

function typeLabel(t: Territory['type']) {
  return { voivodeship: 'Województwo', county: 'Powiat', municipality: 'Gmina', locality: 'Miejscowość' }[t];
}
