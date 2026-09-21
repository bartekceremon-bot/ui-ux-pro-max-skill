import { fetchSourced } from '../http';
import { GEOPORTAL_SOURCES } from '../sources';

export { GEOPORTAL_SOURCES };

export function activeSources() {
  return GEOPORTAL_SOURCES.filter((s) => s.active);
}

/** GetCapabilities jest jedynym pewnym testem, że endpoint nadal żyje. */
export async function capabilities(name: string) {
  const src = GEOPORTAL_SOURCES.find((s) => s.name === name);
  if (!src) {
    return {
      ok: false as const, data: null, error: `Nieznana usługa Geoportalu: ${name}`,
      provenance: {
        source: 'Geoportal', sourceUrl: 'https://www.geoportal.gov.pl',
        retrievedAt: new Date().toISOString(), sourceUpdatedAt: null, recordId: null,
        freshness: 'LIVE' as const, quality: 'OFFICIAL' as const,
      },
    };
  }
  const sep = src.url.includes('?') ? '&' : '?';
  const url = `${src.url}${sep}SERVICE=${src.serviceType === 'WMTS' ? 'WMTS' : src.serviceType}&REQUEST=GetCapabilities`;
  return fetchSourced<string>(url, {
    connectorId: 'geoportal', source: `Geoportal – ${src.name}`, sourceUrl: url,
    ttlSeconds: 12 * 3600, accept: 'text/xml', recordId: src.name, timeoutMs: 20000,
  });
}

export async function healthCheck() {
  return capabilities('Granice administracyjne (PRG)');
}
