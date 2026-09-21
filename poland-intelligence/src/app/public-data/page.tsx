'use client';

import { useState } from 'react';
import type { Provenance } from '@/lib/types';

interface Dataset {
  id: string;
  attributes: {
    title: string; notes?: string; modified?: string; created?: string;
    formats?: string[]; institution?: { title?: string } | null;
    categories?: { title: string }[]; slug?: string;
  };
}

const SUGGESTIONS = ['budżety gmin', 'szkoły', 'przetargi', 'transport', 'środowisko', 'demografia'];

export default function PublicDataPage() {
  const [q, setQ] = useState('budżety gmin');
  const [rows, setRows] = useState<Dataset[] | null>(null);
  const [prov, setProv] = useState<Provenance | null>(null);
  const [status, setStatus] = useState('');

  async function run(query = q) {
    setQ(query);
    setStatus('Przeszukuję katalog dane.gov.pl…');
    const res = await (await fetch(`/api/danegov?q=${encodeURIComponent(query)}`)).json();
    setRows(res.data?.data ?? []);
    setProv(res.provenance ?? null);
    setStatus(res.ok ? `${res.data?.data?.length ?? 0} zbiorów` : (res.error ?? 'Źródło niedostępne'));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Public Data — Data Explorer (dane.gov.pl)</h1>
      <p className="text-sm text-muted">
        Najpierw metadane i struktura zbioru — nie interpretujemy automatycznie zawartości datasetów.
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Czego szukasz?" />
        <button className="btn-primary">Szukaj</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => <li key={s}><button className="btn" onClick={() => void run(s)}>{s}</button></li>)}
      </ul>
      <p className="text-xs text-muted">{status}</p>

      <div className="space-y-3">
        {rows?.map((d) => (
          <article key={d.id} className="card">
            <h2 className="text-sm font-medium">{d.attributes.title}</h2>
            <p className="mt-1 line-clamp-3 text-xs text-muted">{stripTags(d.attributes.notes ?? '')}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
              <span>Instytucja: {d.attributes.institution?.title ?? '—'}</span>
              <span>Aktualizacja: {d.attributes.modified?.slice(0, 10) ?? '—'}</span>
              <span>Formaty: {d.attributes.formats?.join(', ') || '—'}</span>
              <span>Kategorie: {d.attributes.categories?.map((c) => c.title).join(', ') || '—'}</span>
            </div>
            <p className="mt-2 text-[11px]">
              <a className="text-accent hover:underline" href={`https://dane.gov.pl/pl/dataset/${d.id}`} target="_blank" rel="noreferrer">Otwórz w dane.gov.pl</a>
              {' · '}
              <a className="text-accent hover:underline" href={`/api/danegov?id=${d.id}`} target="_blank" rel="noreferrer">Zasoby (JSON)</a>
            </p>
          </article>
        ))}
      </div>

      {prov && (
        <p className="text-[11px] text-muted">
          Źródło: <a className="text-accent hover:underline" href={prov.sourceUrl} target="_blank" rel="noreferrer">{prov.source}</a> ·
          {' '}{prov.freshness} · pobrano {prov.retrievedAt.slice(0, 16).replace('T', ' ')}
        </p>
      )}
    </div>
  );
}

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
