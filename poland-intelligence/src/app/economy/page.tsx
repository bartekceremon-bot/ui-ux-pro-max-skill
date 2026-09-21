'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart, LineChart } from '@/components/Chart';
import type { Provenance } from '@/lib/types';

interface Series {
  key: string; label: string; unit: string; group: string; ok: boolean;
  values: { year: string; val: number | null }[] | null;
  error?: string; provenance: Provenance;
}

export default function EconomyPage() {
  const [name, setName] = useState('Kraków');
  const [units, setUnits] = useState<{ terytCode: string; name: string; type: string }[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [series, setSeries] = useState<Series[] | null>(null);
  const [status, setStatus] = useState('');

  async function findUnits(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Szukam jednostki w GUS BDL / TERYT…');
    const res = await (await fetch(`/api/teryt?name=${encodeURIComponent(name)}`)).json();
    setUnits(res.data ?? []);
    setStatus(res.ok ? `${res.data?.length ?? 0} jednostek` : (res.error ?? 'Źródło niedostępne'));
  }

  async function loadSeries(id: string) {
    setUnitId(id);
    setSeries(null);
    setStatus('Pobieram wskaźniki BDL (10 lat)…');
    const res = await (await fetch(`/api/bdl?unitId=${id}&years=10`)).json();
    setSeries(res.series ?? []);
    setStatus('');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">GUS / Economy — Bank Danych Lokalnych</h1>
      <p className="text-sm text-muted">
        Wskaźniki demografii, gospodarki, rynku pracy i mieszkalnictwa dla wybranej jednostki terytorialnej.
        Nie tworzymy arbitralnych ocen „dobry/zły” — pokazujemy wartości i zmiany.
      </p>
      <form className="flex gap-2" onSubmit={findUnits}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gmina / powiat / województwo" />
        <button className="btn-primary">Szukaj jednostki</button>
      </form>
      <p className="text-xs text-muted">{status}</p>

      {units.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {units.map((u) => (
            <li key={u.terytCode}>
              <button className={`btn ${unitId === u.terytCode ? 'border-accent text-accent' : ''}`} onClick={() => void loadSeries(u.terytCode)}>
                {u.name} <span className="text-muted">({u.type} · {u.terytCode})</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {unitId && (
        <p className="text-xs text-muted">
          <Link className="text-accent hover:underline" href={`/locations/${unitId}`}>Otwórz pełny panel Poland 360 dla jednostki {unitId} →</Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {series?.map((s) => {
          const values = (s.values ?? []).filter((v) => v.val !== null).sort((a, b) => Number(a.year) - Number(b.year));
          const points = values.map((v) => ({ label: v.year, value: Number(v.val) }));
          const first = points[0];
          const last = points[points.length - 1];
          const delta = first && last && first.value ? ((last.value - first.value) / first.value) * 100 : null;
          return (
            <article key={s.key} className="card">
              <h2 className="card-title">{s.group} · {s.label}</h2>
              <div className="metric">
                {last ? `${new Intl.NumberFormat('pl-PL').format(last.value)} ${s.unit}` : 'brak danych'}
              </div>
              {last && <p className="text-xs text-muted">Rok {last.label}{delta !== null ? ` · zmiana ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% od ${first.label}` : ''}</p>}
              {points.length > 1 ? <LineChart points={points} unit={s.unit} /> : <BarChart points={points} unit={s.unit} />}
              {s.error && <p className="mt-1 text-xs text-warn">{s.error}</p>}
              <p className="mt-2 text-[11px] text-muted">
                Źródło: <a className="text-accent hover:underline" href={s.provenance.sourceUrl} target="_blank" rel="noreferrer">{s.provenance.source}</a> ·
                {' '}{s.provenance.freshness} · pobrano {s.provenance.retrievedAt.slice(0, 16).replace('T', ' ')}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
