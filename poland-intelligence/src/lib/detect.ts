import type { DetectedQuery } from './types';

const digits = (s: string) => s.replace(/[^0-9]/g, '');

export function isValidNip(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 10) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((acc, wi, i) => acc + wi * Number(d[i]), 0);
  return sum % 11 === Number(d[9]);
}

export function isValidRegon(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 9 && d.length !== 14) return false;
  const weights = d.length === 9 ? [8, 9, 2, 3, 4, 5, 6, 7] : [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
  const sum = weights.reduce((acc, wi, i) => acc + wi * Number(d[i]), 0);
  const check = sum % 11 === 10 ? 0 : sum % 11;
  return check === Number(d[d.length - 1]);
}

export function isKrsNumber(raw: string): boolean {
  const d = digits(raw);
  return d.length === 10 && /^0/.test(d);
}

/** Recognises what the user typed so the search fans out to the right sources. */
export function detectQuery(input: string): DetectedQuery[] {
  const q = input.trim();
  const out: DetectedQuery[] = [];
  if (!q) return out;

  const d = digits(q);
  const explicitNip = /\bnip\b/i.test(q);
  const explicitRegon = /\bregon\b/i.test(q);
  const explicitKrs = /\bkrs\b/i.test(q);

  if (isValidNip(q) || (explicitNip && d.length === 10)) {
    out.push({ kind: 'nip', value: q, normalized: d, confidence: isValidNip(q) ? 'HIGH' : 'MEDIUM', reason: ' 10 cyfr, suma kontrolna NIP.' });
  }
  if (isValidRegon(q) || (explicitRegon && (d.length === 9 || d.length === 14))) {
    out.push({ kind: 'regon', value: q, normalized: d, confidence: isValidRegon(q) ? 'HIGH' : 'MEDIUM', reason: 'Długość i suma kontrolna REGON.' });
  }
  if (isKrsNumber(q) || (explicitKrs && d.length === 10)) {
    out.push({ kind: 'krs', value: q, normalized: d.padStart(10, '0'), confidence: 'HIGH', reason: '10 cyfr rozpoczynających się od 0 – format KRS.' });
  }
  if (/^\d{2}-\d{3}$/.test(q)) {
    out.push({ kind: 'postal_code', value: q, normalized: q, confidence: 'HIGH', reason: 'Format kodu pocztowego XX-XXX.' });
  }
  const coord = q.match(/^\s*(-?\d{1,2}[.,]\d+)\s*[,; ]\s*(-?\d{1,3}[.,]\d+)\s*$/);
  if (coord) {
    out.push({
      kind: 'coordinates', value: q,
      normalized: `${coord[1].replace(',', '.')},${coord[2].replace(',', '.')}`,
      confidence: 'HIGH', reason: 'Para współrzędnych lat,lon.',
    });
  }
  if (/^\d{7}$/.test(d) && d === q) {
    out.push({ kind: 'teryt', value: q, normalized: d, confidence: 'MEDIUM', reason: '7 cyfr – możliwy identyfikator TERYT gminy.' });
  }
  if (/\b(ul\.|ulica|al\.|aleja|os\.|pl\.)\b/i.test(q) || /\d+[a-z]?\b/.test(q) && /[a-ząćęłńóśźż]{3,}/i.test(q) && /,/.test(q)) {
    out.push({ kind: 'address', value: q, normalized: q, confidence: 'MEDIUM', reason: 'Wzorzec adresu (ulica + numer).' });
  }
  if (/^(gmina|powiat|województwo|woj\.)\s+/i.test(q)) {
    out.push({ kind: 'place', value: q, normalized: q, confidence: 'HIGH', reason: 'Prefiks jednostki terytorialnej.' });
  }
  if (out.length === 0) {
    if (/^[\p{L}\s.'-]{2,}$/u.test(q)) {
      out.push({ kind: 'place', value: q, normalized: q, confidence: 'LOW', reason: 'Tekst – może być miejscowością.' });
      out.push({ kind: 'company_name', value: q, normalized: q, confidence: 'LOW', reason: 'Tekst – może być nazwą firmy.' });
    } else {
      out.push({ kind: 'company_name', value: q, normalized: q, confidence: 'LOW', reason: 'Zapytanie tekstowe.' });
    }
  }
  return out;
}

/** Entity resolution priority: NIP > REGON > KRS > exact name/address > fuzzy. */
export const RESOLUTION_PRIORITY: Record<string, number> = {
  nip: 100, regon: 90, krs: 80, address: 60, place: 50, postal_code: 40,
  coordinates: 40, teryt: 40, company_name: 20,
};
