import { fetchSourced } from '../http';
import { source } from '../sources';

const S = () => source('nfz');
const API_VERSION = '1.2';

export interface NfzProviderAttributes {
  code?: string; name?: string; 'post-code'?: string; place?: string;
  street?: string; 'nip'?: string; 'phone'?: string;
}

/** Świadczeniodawcy z umowami NFZ – wyłącznie dane publiczne i zagregowane. */
export async function providers(params: { name?: string; place?: string; year?: number }) {
  const s = S();
  const qs = new URLSearchParams({
    'api-version': API_VERSION,
    limit: '25',
    page: '1',
    format: 'json',
    year: String(params.year ?? new Date().getFullYear()),
  });
  if (params.name) qs.set('name', params.name);
  if (params.place) qs.set('place', params.place);
  const url = `${s.apiBase}/app-umw-api/providers?${qs.toString()}`;
  return fetchSourced<{ data: { id: string; attributes: NfzProviderAttributes }[]; meta?: { count?: number } }>(url, {
    connectorId: 'nfz', source: 'NFZ – świadczeniodawcy (umowy)', sourceUrl: url,
    ttlSeconds: 12 * 3600, recordId: qs.toString(),
  });
}

/** Kolejki / terminy leczenia dla lokalizacji. */
export async function queues(params: { province?: string; benefit?: string; locality?: string; case?: 1 | 2 }) {
  const s = S();
  const qs = new URLSearchParams({
    'api-version': API_VERSION, limit: '25', page: '1', format: 'json',
    case: String(params.case ?? 1),
  });
  if (params.province) qs.set('province', params.province);
  if (params.benefit) qs.set('benefit', params.benefit);
  if (params.locality) qs.set('locality', params.locality);
  const url = `${s.apiBase}/app-itl-api/queues?${qs.toString()}`;
  return fetchSourced<{ data: { id: string; attributes: Record<string, unknown> }[] }>(url, {
    connectorId: 'nfz', source: 'NFZ – informator o terminach leczenia', sourceUrl: url,
    ttlSeconds: 6 * 3600, recordId: qs.toString(),
  });
}

export async function healthCheck() {
  return providers({ place: 'KRAKÓW' });
}
