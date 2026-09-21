import { fetchSourced } from '../http';
import { source } from '../sources';

export interface DatasetAttributes {
  title: string; notes?: string; created?: string; modified?: string;
  formats?: string[]; categories?: { title: string }[];
  institution?: { title?: string } | null; url?: string; slug?: string;
}
export interface Dataset { id: string; type: string; attributes: DatasetAttributes }

export async function searchDatasets(q: string, page = 1) {
  const s = source('danegov');
  const url = `${s.apiBase}/datasets?q=${encodeURIComponent(q)}&page=${page}&per_page=20`;
  return fetchSourced<{ data: Dataset[]; meta?: { count?: number } }>(url, {
    connectorId: 'danegov', source: 'dane.gov.pl – katalog danych publicznych',
    sourceUrl: url, ttlSeconds: 6 * 3600, recordId: q,
    headers: { Accept: 'application/vnd.api+json' },
    accept: 'application/vnd.api+json',
  });
}

export async function dataset(id: string) {
  const s = source('danegov');
  const url = `${s.apiBase}/datasets/${encodeURIComponent(id)}`;
  return fetchSourced<{ data: Dataset }>(url, {
    connectorId: 'danegov', source: 'dane.gov.pl – zbiór danych', sourceUrl: url,
    ttlSeconds: 6 * 3600, recordId: id,
    headers: { Accept: 'application/vnd.api+json' }, accept: 'application/vnd.api+json',
  });
}

export async function datasetResources(id: string) {
  const s = source('danegov');
  const url = `${s.apiBase}/datasets/${encodeURIComponent(id)}/resources`;
  return fetchSourced<{ data: { id: string; attributes: Record<string, unknown> }[] }>(url, {
    connectorId: 'danegov', source: 'dane.gov.pl – zasoby zbioru', sourceUrl: url,
    ttlSeconds: 6 * 3600, recordId: id,
    headers: { Accept: 'application/vnd.api+json' }, accept: 'application/vnd.api+json',
  });
}

export async function healthCheck() {
  return searchDatasets('budżet');
}
