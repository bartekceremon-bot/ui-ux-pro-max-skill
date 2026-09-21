import { fetchSourced } from '../http';
import { source } from '../sources';

const S = () => source('nbp');

export interface NbpRate { no: string; effectiveDate: string; mid: number }
export interface NbpSeries { code: string; currency: string; rates: NbpRate[] }

export const NBP_MAIN = ['EUR', 'USD', 'GBP', 'CHF', 'CNY'];

export async function series(code: string, days = 30) {
  const s = S();
  const url = `${s.apiBase}/exchangerates/rates/a/${code.toLowerCase()}/last/${Math.min(days, 255)}/?format=json`;
  return fetchSourced<NbpSeries>(url, {
    connectorId: 'nbp', source: 'NBP – tabela A', sourceUrl: url, ttlSeconds: 3600, recordId: code,
  });
}

export async function gold(days = 30) {
  const s = S();
  const url = `${s.apiBase}/cenyzlota/last/${Math.min(days, 255)}/?format=json`;
  return fetchSourced<{ data: string; cena: number }[]>(url, {
    connectorId: 'nbp', source: 'NBP – cena złota', sourceUrl: url, ttlSeconds: 3600,
  });
}

export async function healthCheck() {
  const s = S();
  const url = `${s.apiBase}/exchangerates/tables/a/?format=json`;
  return fetchSourced<unknown>(url, { connectorId: 'nbp', source: 'NBP', sourceUrl: url, ttlSeconds: 300 });
}
