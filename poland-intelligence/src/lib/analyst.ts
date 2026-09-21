import { poland360, haversine } from './poland360';
import * as bdl from './integrations/bdl';
import * as osm from './integrations/osm';
import * as teryt from './integrations/teryt';
import type { Provenance } from './types';

export interface AnalystAnswer {
  question: string;
  answer: string[];
  sources: { label: string; url: string; retrievedAt: string; freshness: string }[];
  dataAsOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  insufficient: boolean;
}

const NO_DATA = 'Brak wystarczających danych do odpowiedzi.';

/**
 * Analityk deterministyczny: każde zdanie powstaje wyłącznie z pobranych
 * rekordów. Brak danych => komunikat o braku, nigdy zmyślona treść.
 */
export async function ask(question: string, context: { place?: string; lat?: number; lon?: number; unitId?: string | null; radiusKm?: number }): Promise<AnalystAnswer> {
  const q = question.toLowerCase();
  const sources: AnalystAnswer['sources'] = [];
  const lines: string[] = [];
  const addSource = (p: Provenance) =>
    sources.push({ label: p.source, url: p.sourceUrl, retrievedAt: p.retrievedAt, freshness: p.freshness });

  let lat = context.lat;
  let lon = context.lon;
  let place = context.place;
  let unitId = context.unitId ?? null;

  if ((lat === undefined || lon === undefined) && place) {
    const g = await osm.geocode(place, 1);
    if (g.ok && g.data?.[0]) {
      lat = Number(g.data[0].lat);
      lon = Number(g.data[0].lon);
      addSource(g.provenance);
    }
  }
  if (!unitId && place) {
    const t = await teryt.search(place);
    if (t.ok && t.data?.[0]) {
      unitId = t.data[0].terytCode;
      addSource(t.provenance);
    }
  }
  if (lat === undefined || lon === undefined) {
    return answer(question, [NO_DATA], sources, 'LOW', true);
  }

  const wantsPopulation = /mieszkań|ludnoś|demograf|populacj/.test(q);
  const wantsUnemployment = /bezroboc|prac|zatrudnien/.test(q);
  const wantsBusiness = /firm|przedsiębior|biznes|podmiot/.test(q);
  const wantsAir = /powietrz|pm10|pm2|smog|jakość powietrza/.test(q);
  const wantsInfra = /infrastruktur|szkoł|szpital|poi|promieniu|okolic/.test(q);
  const wantsData = /dane publiczne|dataset|zbior/.test(q);
  const generic = !(wantsPopulation || wantsUnemployment || wantsBusiness || wantsAir || wantsInfra || wantsData);

  if (unitId && (wantsPopulation || wantsUnemployment || wantsBusiness || generic)) {
    const keys = wantsPopulation ? ['population']
      : wantsUnemployment ? ['unemployed', 'wages']
      : wantsBusiness ? ['entities_regon']
      : ['population', 'entities_regon', 'unemployed'];
    for (const key of keys) {
      const v = bdl.BDL_VARIABLES.find((x) => x.key === key)!;
      const res = await bdl.variableForUnit(v.variableId, unitId, 10);
      addSource(res.provenance);
      const values = (res.data?.results?.[0]?.values ?? []).filter((x) => x.val !== null);
      if (values.length === 0) {
        lines.push(`${v.label}: brak danych w GUS BDL dla jednostki ${unitId}.`);
        continue;
      }
      const sorted = [...values].sort((a, b) => Number(a.year) - Number(b.year));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const delta = first.val && last.val ? ((last.val - first.val) / first.val) * 100 : null;
      lines.push(
        `${v.label} (${v.unit}): ${last.val} w ${last.year}; ${first.val} w ${first.year}` +
        (delta === null ? '.' : `; zmiana ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% w okresie ${first.year}–${last.year}.`),
      );
    }
  } else if (!unitId && (wantsPopulation || wantsUnemployment || wantsBusiness)) {
    lines.push('Nie udało się jednoznacznie dopasować jednostki terytorialnej (GUS BDL) – brak danych statystycznych.');
  }

  if (wantsAir || generic) {
    const panel = await poland360({ name: place ?? 'lokalizacja', lat, lon, unitId, radiusMeters: (context.radiusKm ?? 5) * 1000 });
    const air = panel.sections.find((s) => s.id === 'air');
    if (air) {
      addSource(air.provenance);
      if (air.ok && air.data) {
        const d = air.data as { station: { stationName: string }; distanceKm: number; index: unknown };
        const idx = (d.index as Record<string, unknown> | null) ?? null;
        const level = idx && typeof idx === 'object'
          ? String((idx as Record<string, Record<string, string>>)['stIndexLevel']?.['indexLevelName'] ?? (idx as Record<string, unknown>)['AqIndex'] ?? 'brak wartości indeksu')
          : 'brak wartości indeksu';
        lines.push(`Najbliższa stacja GIOŚ: ${d.station.stationName} (${d.distanceKm} km). Indeks jakości powietrza: ${level}.`);
      } else {
        lines.push('Jakość powietrza: źródło GIOŚ nie zwróciło danych.');
      }
    }
  }

  if (wantsInfra || generic) {
    const radius = (context.radiusKm ?? 5) * 1000;
    for (const preset of ['szkoly', 'szpitale', 'apteki'] as const) {
      const res = await osm.poiAround(lat, lon, radius, preset);
      addSource(res.provenance);
      if (res.ok && res.data) {
        lines.push(`OSM – ${preset.replace('_', ' ')}: ${res.data.elements.length} obiektów w promieniu ${radius / 1000} km (dane społecznościowe, nie rejestr urzędowy).`);
      } else {
        lines.push(`OSM – ${preset}: brak odpowiedzi ze źródła.`);
      }
    }
  }

  if (lines.length === 0) return answer(question, [NO_DATA], sources, 'LOW', true);

  const confidence: AnalystAnswer['confidence'] =
    sources.some((s) => s.freshness === 'LIVE') && lines.length >= 3 ? 'HIGH'
      : lines.length >= 2 ? 'MEDIUM' : 'LOW';
  return answer(question, lines, sources, confidence, false);
}

function answer(question: string, lines: string[], sources: AnalystAnswer['sources'], confidence: AnalystAnswer['confidence'], insufficient: boolean): AnalystAnswer {
  return { question, answer: lines, sources, dataAsOf: new Date().toISOString(), confidence, insufficient };
}

export { haversine };
