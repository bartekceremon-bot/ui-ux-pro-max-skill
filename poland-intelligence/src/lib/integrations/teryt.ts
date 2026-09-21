import { searchUnits, unit } from './bdl';
import type { Territory } from '../types';

/**
 * TERYT jest warstwą referencyjną. Pełne API TERYT (SOAP) wymaga konta GUS,
 * dlatego identyfikatory jednostek pobieramy z BDL (identyfikatory zgodne z TERYT),
 * a użytkownik zawsze widzi, z którego źródła pochodzi rekord.
 */
export function levelToType(level: number): Territory['type'] {
  if (level <= 2) return 'voivodeship';
  if (level === 4) return 'county';
  if (level === 5) return 'municipality';
  return 'locality';
}

export async function search(name: string) {
  const res = await searchUnits(name);
  if (!res.ok || !res.data?.results) return { ...res, data: null as Territory[] | null };
  const territories: Territory[] = res.data.results.map((r) => ({
    terytCode: r.id,
    name: r.name,
    type: levelToType(r.level),
    parentTerritory: null,
  }));
  return { ...res, data: territories };
}

export async function get(unitId: string) {
  const res = await unit(unitId);
  if (!res.ok || !res.data) return { ...res, data: null as Territory | null };
  const t: Territory = {
    terytCode: res.data.id,
    name: res.data.name,
    type: levelToType(res.data.level),
    parentTerritory: res.data.parentId ?? null,
  };
  return { ...res, data: t };
}

export async function healthCheck() {
  return search('Lanckorona');
}
