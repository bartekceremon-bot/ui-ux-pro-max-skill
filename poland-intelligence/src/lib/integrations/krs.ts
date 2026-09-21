import { fetchSourced } from '../http';
import { source } from '../sources';
import type { Entity } from '../types';

const S = () => source('krs');

export type KrsRegister = 'P' | 'S';

export interface KrsOdpis {
  odpis?: {
    naglowekA?: { numerKRS?: string; rejestr?: string; stanZDnia?: string; dataRejestracjiWKRS?: string };
    dane?: {
      dzial1?: {
        danePodmiotu?: {
          nazwa?: string; formaPrawna?: string; identyfikatory?: { nip?: string; regon?: string };
        };
        siedzibaIAdres?: {
          siedziba?: { wojewodztwo?: string; powiat?: string; gmina?: string; miejscowosc?: string };
          adres?: { ulica?: string; nrDomu?: string; nrLokalu?: string; miejscowosc?: string; kodPocztowy?: string; kraj?: string };
        };
        przedmiotDzialalnosci?: {
          przedmiotPrzewazajacejDzialalnosci?: { kodPKD?: string; opis?: string }[];
          przedmiotPozostalejDzialalnosci?: { kodPKD?: string; opis?: string }[];
        };
      };
      dzial2?: { reprezentacja?: { sklad?: { nazwisko?: string; imiona?: string; funkcjaWOrganie?: string }[]; nazwa?: string } };
      dzial6?: unknown;
    };
  };
}

/** KRS Open API – aktualny odpis dla numeru KRS. */
export async function byKrs(krs: string, register: KrsRegister = 'P') {
  const s = S();
  const num = krs.replace(/\D/g, '').padStart(10, '0');
  const url = `${s.apiBase}/OdpisAktualny/${num}?rejestr=${register}&format=json`;
  return fetchSourced<KrsOdpis>(url, {
    connectorId: 'krs', source: `KRS – odpis aktualny (rejestr ${register})`,
    sourceUrl: url, ttlSeconds: 12 * 3600, recordId: num,
  });
}

/** Odpis pełny – historia wpisów, o ile API ją udostępnia. */
export async function fullExtract(krs: string, register: KrsRegister = 'P') {
  const s = S();
  const num = krs.replace(/\D/g, '').padStart(10, '0');
  const url = `${s.apiBase}/OdpisPelny/${num}?rejestr=${register}&format=json`;
  return fetchSourced<KrsOdpis>(url, {
    connectorId: 'krs', source: `KRS – odpis pełny (rejestr ${register})`,
    sourceUrl: url, ttlSeconds: 12 * 3600, recordId: num,
  });
}

export function normalize(odpis: KrsOdpis, krs: string): Entity | null {
  const d1 = odpis?.odpis?.dane?.dzial1;
  const podmiot = d1?.danePodmiotu;
  if (!podmiot?.nazwa) return null;
  const adres = d1?.siedzibaIAdres?.adres;
  const siedziba = d1?.siedzibaIAdres?.siedziba;
  const pkd = [
    ...(d1?.przedmiotDzialalnosci?.przedmiotPrzewazajacejDzialalnosci ?? []),
    ...(d1?.przedmiotDzialalnosci?.przedmiotPozostalejDzialalnosci ?? []),
  ].map((p) => [p.kodPKD, p.opis].filter(Boolean).join(' – '));

  return {
    entityId: `krs:${krs}`,
    name: podmiot.nazwa,
    nip: podmiot.identyfikatory?.nip ?? null,
    regon: podmiot.identyfikatory?.regon ?? null,
    krs,
    legalForm: podmiot.formaPrawna ?? null,
    address: [adres?.ulica, [adres?.nrDomu, adres?.nrLokalu].filter(Boolean).join('/')].filter(Boolean).join(' ') || null,
    city: adres?.miejscowosc ?? siedziba?.miejscowosc ?? null,
    postalCode: adres?.kodPocztowy ?? null,
    voivodeship: siedziba?.wojewodztwo ?? null,
    county: siedziba?.powiat ?? null,
    municipality: siedziba?.gmina ?? null,
    pkd: pkd.length ? pkd : null,
    status: odpis?.odpis?.naglowekA?.stanZDnia ? `Stan na ${odpis.odpis.naglowekA.stanZDnia}` : null,
    source: 'KRS',
    sourceTimestamp: new Date().toISOString(),
  };
}

export async function healthCheck() {
  return byKrs('0000006865', 'P');
}
