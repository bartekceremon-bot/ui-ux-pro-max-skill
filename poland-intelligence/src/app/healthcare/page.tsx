'use client';

import { useState } from 'react';
import type { Provenance } from '@/lib/types';

interface Provider { id: string; attributes: Record<string, string | undefined> }

export default function HealthcarePage() {
  const [place, setPlace] = useState('KRAKÓW');
  const [rows, setRows] = useState<Provider[] | null>(null);
  const [prov, setProv] = useState<Provenance | null>(null);
  const [status, setStatus] = useState('');

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Pobieram dane NFZ…');
    const res = await (await fetch(`/api/nfz?place=${encodeURIComponent(place)}`)).json();
    setRows(res.data?.data ?? []);
    setProv(res.provenance ?? null);
    setStatus(res.ok ? '' : (res.error ?? 'Źródło chwilowo niedostępne.'));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Healthcare Intelligence — NFZ</h1>
      <p className="text-sm text-muted">
        Świadczeniodawcy z umowami NFZ dla wskazanej miejscowości. Prezentujemy wyłącznie dane publiczne
        i zagregowane — żadnych danych medycznych osób.
      </p>
      <form className="flex gap-2" onSubmit={run}>
        <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Miejscowość (np. KRAKÓW)" />
        <button className="btn-primary">Szukaj</button>
      </form>
      {status && <p className="text-xs text-warn">{status}</p>}

      {rows && (
        <div className="card overflow-auto">
          <table className="table">
            <thead><tr><th>Nazwa</th><th>Miejscowość</th><th>Adres</th><th>Kod</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.attributes.name ?? '—'}</td>
                  <td className="text-muted">{r.attributes.place ?? '—'}</td>
                  <td className="text-muted">{r.attributes.street ?? '—'}</td>
                  <td className="font-mono text-muted">{r.attributes.code ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="text-muted">Brak wyników.</td></tr>}
            </tbody>
          </table>
          {prov && (
            <p className="mt-2 text-[11px] text-muted">
              Źródło: <a className="text-accent hover:underline" href={prov.sourceUrl} target="_blank" rel="noreferrer">{prov.source}</a> ·
              {' '}{prov.freshness} · pobrano {prov.retrievedAt.slice(0, 16).replace('T', ' ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
