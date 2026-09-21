import { fetchSourced } from '../http';
import { source } from '../sources';

const S = () => source('bdl');
const headers = (): Record<string, string> =>
  process.env.GUS_CLIENT_ID ? { 'X-ClientId': process.env.GUS_CLIENT_ID } : {};

/**
 * Curated BDL variables used by the Location Intelligence panel.
 * Variable ids are stable BDL identifiers; each is shown with its own source link.
 */
export const BDL_VARIABLES: { key: string; label: string; variableId: number; unit: string; group: string }[] = [
  { key: 'population', label: 'Ludność ogółem', variableId: 72305, unit: 'osoby', group: 'Demografia' },
  { key: 'population_female', label: 'Ludność – kobiety', variableId: 72306, unit: 'osoby', group: 'Demografia' },
  { key: 'population_male', label: 'Ludność – mężczyźni', variableId: 72307, unit: 'osoby', group: 'Demografia' },
  { key: 'entities_regon', label: 'Podmioty gospodarki narodowej w REGON', variableId: 458128, unit: 'podmioty', group: 'Gospodarka' },
  { key: 'unemployed', label: 'Bezrobotni zarejestrowani', variableId: 10430, unit: 'osoby', group: 'Rynek pracy' },
  { key: 'wages', label: 'Przeciętne wynagrodzenie brutto', variableId: 64428, unit: 'zł', group: 'Rynek pracy' },
  { key: 'dwellings', label: 'Mieszkania oddane do użytkowania', variableId: 38300, unit: 'mieszkania', group: 'Mieszkalnictwo' },
];

export interface BdlDataPoint { year: string; val: number | null }
export interface BdlSeries { variableId: number; label: string; unit: string; values: BdlDataPoint[] }

export async function variableForUnit(variableId: number, unitId: string, years = 10) {
  const s = S();
  const now = new Date().getFullYear();
  const yearParams = Array.from({ length: years }, (_, i) => `year=${now - 1 - i}`).join('&');
  const url = `${s.apiBase}/data/by-variable/${variableId}?unit-id=${unitId}&${yearParams}&format=json`;
  return fetchSourced<{ results?: { values: { year: string; val: number | null }[] }[] }>(url, {
    connectorId: 'bdl', source: 'GUS – Bank Danych Lokalnych', sourceUrl: url,
    ttlSeconds: 24 * 3600, headers: headers(), recordId: `${variableId}/${unitId}`,
  });
}

export async function searchUnits(name: string) {
  const s = S();
  const url = `${s.apiBase}/units/search?name=${encodeURIComponent(name)}&page-size=25&format=json`;
  return fetchSourced<{ results?: { id: string; name: string; level: number }[] }>(url, {
    connectorId: 'bdl', source: 'GUS BDL – jednostki terytorialne', sourceUrl: url,
    ttlSeconds: 24 * 3600, headers: headers(), recordId: name,
  });
}

export async function unit(unitId: string) {
  const s = S();
  const url = `${s.apiBase}/units/${unitId}?format=json`;
  return fetchSourced<{ id: string; name: string; level: number; parentId?: string }>(url, {
    connectorId: 'bdl', source: 'GUS BDL – jednostka', sourceUrl: url,
    ttlSeconds: 24 * 3600, headers: headers(), recordId: unitId,
  });
}

export async function healthCheck() {
  return searchUnits('Kraków');
}
