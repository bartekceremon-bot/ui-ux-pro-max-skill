import { fetchSourced, unconfigured } from '../http';
import { hasKey, source } from '../sources';

const S = () => source('regon');

/**
 * REGON/BIR1 to usługa SOAP wymagająca klucza użytkownika (GUS_REGON_KEY).
 * Implementujemy logowanie i wyszukiwanie po NIP/REGON/KRS.
 */
async function login(): Promise<string | null> {
  const key = process.env.GUS_REGON_KEY;
  if (!key) return null;
  const s = S();
  const envelope = soap(
    'http://CIS/BIR/PublUdostepnianie/2019/06/IUslugaBIRzewnPubl/Zaloguj',
    `<ns:Zaloguj><ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika></ns:Zaloguj>`,
  );
  const res = await fetchSourced<string>(s.apiBase, {
    connectorId: 'regon', source: 'GUS REGON (BIR1) – logowanie', sourceUrl: s.docs,
    method: 'POST', body: envelope, accept: 'text/xml', ttlSeconds: 1200,
    headers: {
      'Content-Type': 'application/soap+xml;charset=UTF-8',
      'action': 'http://CIS/BIR/PublUdostepnianie/2019/06/IUslugaBIRzewnPubl/Zaloguj',
    },
  });
  if (!res.ok || !res.data) return null;
  return res.data.match(/<ZalogujResult>([^<]+)<\/ZalogujResult>/)?.[1] ?? null;
}

export async function searchBy(kind: 'nip' | 'regon' | 'krs', value: string) {
  const s = S();
  if (!hasKey('regon')) {
    return unconfigured<Record<string, string>[]>('GUS REGON (BIR1)', s.docs, 'GUS_REGON_KEY (klucz użytkownika BIR1)');
  }
  const sid = await login();
  if (!sid) {
    return unconfigured<Record<string, string>[]>('GUS REGON (BIR1)', s.docs, 'sesja BIR1 (logowanie nie powiodło się)');
  }
  const param = kind === 'nip' ? 'Nip' : kind === 'regon' ? 'Regon' : 'Krs';
  const envelope = soap(
    'http://CIS/BIR/PublUdostepnianie/2019/06/IUslugaBIRzewnPubl/DaneSzukajPodmioty',
    `<ns:DaneSzukajPodmioty><ns:pParametryWyszukiwania><dat:${param}>${value}</dat:${param}></ns:pParametryWyszukiwania></ns:DaneSzukajPodmioty>`,
  );
  const res = await fetchSourced<string>(s.apiBase, {
    connectorId: 'regon', source: 'GUS REGON (BIR1) – DaneSzukajPodmioty', sourceUrl: s.docs,
    method: 'POST', body: envelope, accept: 'text/xml', ttlSeconds: 6 * 3600, recordId: `${kind}:${value}`,
    headers: {
      'Content-Type': 'application/soap+xml;charset=UTF-8',
      'action': 'http://CIS/BIR/PublUdostepnianie/2019/06/IUslugaBIRzewnPubl/DaneSzukajPodmioty',
      sid,
    },
  });
  if (!res.ok || !res.data) return { ...res, data: null as Record<string, string>[] | null };
  return { ...res, data: parseDane(res.data) };
}

export function parseDane(xml: string): Record<string, string>[] {
  const inner = xml.match(/<DaneSzukajPodmiotyResult>([\s\S]*?)<\/DaneSzukajPodmiotyResult>/)?.[1] ?? '';
  const decoded = inner.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const rows = decoded.match(/<dane>([\s\S]*?)<\/dane>/g) ?? [];
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const m of row.matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) out[m[1]] = m[2];
    return out;
  });
}

function soap(action: string, body: string) {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PublUdostepnianie/2019/06" xmlns:dat="http://CIS/BIR/PublUdostepnianie/2019/06/DataContract">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
    <wsa:To>${S().apiBase}</wsa:To>
    <wsa:Action>${action}</wsa:Action>
  </soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

export async function healthCheck() {
  return searchBy('nip', '5261040828');
}
