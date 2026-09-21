import { fetchSourced, unconfigured } from '../http';
import { hasKey, source } from '../sources';
import type { Entity } from '../types';

const S = () => source('ceidg');

export interface CeidgCompany {
  id: string; nazwa?: string; nip?: string; regon?: string; status?: string;
  dataRozpoczecia?: string; dataZakonczenia?: string | null; dataZawieszenia?: string | null;
  pkd?: string[]; pkdGlowny?: string;
  adresDzialalnosci?: { ulica?: string; budynek?: string; lokal?: string; miejscowosc?: string; kod?: string; wojewodztwo?: string; powiat?: string; gmina?: string };
  link?: string;
}

function auth(): Record<string, string> {
  const jwt = process.env.CEIDG_JWT;
  return jwt ? { Authorization: `Bearer ${jwt}` } : {};
}

/** CEIDG v3 wymaga tokenu JWT – bez niego zwracamy jawny brak konfiguracji. */
export async function search(params: { nip?: string; regon?: string; nazwa?: string }) {
  const s = S();
  if (!hasKey('ceidg')) {
    return unconfigured<{ firmy: CeidgCompany[] }>('CEIDG', s.docs, 'CEIDG_JWT (token API CEIDG v3)');
  }
  const qs = new URLSearchParams();
  if (params.nip) qs.set('nip', params.nip);
  if (params.regon) qs.set('regon', params.regon);
  if (params.nazwa) qs.set('nazwa', params.nazwa);
  qs.set('limit', '25');
  const url = `${s.apiBase}/firmy?${qs.toString()}`;
  return fetchSourced<{ firmy: CeidgCompany[] }>(url, {
    connectorId: 'ceidg', source: 'CEIDG (dane.biznes.gov.pl)', sourceUrl: url,
    ttlSeconds: 6 * 3600, headers: auth(), recordId: qs.toString(),
  });
}

/** Minimalizacja danych osobowych: eksponujemy wyłącznie dane podmiotu gospodarczego. */
export function normalize(c: CeidgCompany): Entity {
  const a = c.adresDzialalnosci;
  return {
    entityId: `ceidg:${c.id}`,
    name: c.nazwa ?? '(brak nazwy w rejestrze)',
    nip: c.nip ?? null,
    regon: c.regon ?? null,
    krs: null,
    legalForm: 'Jednoosobowa działalność gospodarcza',
    address: [a?.ulica, [a?.budynek, a?.lokal].filter(Boolean).join('/')].filter(Boolean).join(' ') || null,
    city: a?.miejscowosc ?? null,
    postalCode: a?.kod ?? null,
    voivodeship: a?.wojewodztwo ?? null,
    county: a?.powiat ?? null,
    municipality: a?.gmina ?? null,
    pkd: c.pkd ?? (c.pkdGlowny ? [c.pkdGlowny] : null),
    status: c.status ?? null,
    source: 'CEIDG',
    sourceTimestamp: new Date().toISOString(),
  };
}

export async function healthCheck() {
  return search({ nazwa: 'test' });
}
