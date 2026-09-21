'use client';

import { useCallback, useEffect, useState } from 'react';
import SourceBadge from '@/components/SourceBadge';
import AskPanel from '@/components/AskPanel';
import WatchButton from '@/components/WatchButton';
import type { Provenance } from '@/lib/types';

interface Section {
  id: string; title: string; ok: boolean; data: unknown; error?: string; provenance: Provenance;
}

export default function Poland360Panel({
  name, lat, lon, unitId,
}: { name: string; lat: number; lon: number; unitId: string | null }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [status, setStatus] = useState('Pobieram dane ze wszystkich źródeł…');

  const load = useCallback(async () => {
    setStatus('Pobieram dane ze wszystkich źródeł…');
    const qs = new URLSearchParams({ name, lat: String(lat), lon: String(lon), radius: String(radiusKm * 1000) });
    if (unitId) qs.set('unitId', unitId);
    const res = await (await fetch(`/api/poland360?${qs.toString()}`)).json();
    setSections(res.sections ?? []);
    setStatus(`Wygenerowano: ${String(res.generatedAt).slice(0, 19).replace('T', ' ')}`);
  }, [name, lat, lon, unitId, radiusKm]);

  useEffect(() => { void load(); }, [load]);

  const reportQs = new URLSearchParams({ name, lat: String(lat), lon: String(lon), radius: String(radiusKm * 1000) });
  if (unitId) reportQs.set('unitId', unitId);

  return (
    <div className="space-y-4">
      <header className="card flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">POLAND 360 — {name}</h1>
          <p className="text-xs text-muted">
            {lat.toFixed(5)}, {lon.toFixed(5)} · jednostka BDL/TERYT: {unitId ?? 'nie ustalono'} · {status}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Promień (km)
            <input className="input mt-1 w-24" type="number" min={1} max={20} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
          </label>
          <button className="btn" onClick={() => void load()}>Odśwież</button>
          <a className="btn" href={`/api/report?${reportQs.toString()}&format=html`} target="_blank" rel="noreferrer">Raport HTML</a>
          <a className="btn" href={`/api/report?${reportQs.toString()}&format=csv`}>CSV</a>
          <a className="btn" href={`/api/report?${reportQs.toString()}&format=json`} target="_blank" rel="noreferrer">JSON</a>
          <WatchButton item={{ kind: 'territory', id: `place:${name}`, label: name, href: `/locations?name=${encodeURIComponent(name)}&lat=${lat}&lon=${lon}`, snapshot: { name } }} />
        </div>
      </header>

      <AskPanel place={name} lat={lat} lon={lon} unitId={unitId} radiusKm={radiusKm} />

      <div className="grid gap-4 lg:grid-cols-2">
        {sections?.map((s) => (
          <article key={s.id} className="card">
            <h2 className="card-title">{s.title}</h2>
            {s.ok ? (
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted">
                {JSON.stringify(s.data, null, 2)?.slice(0, 4000)}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-warn">{s.error ?? 'Brak danych ze źródła.'}</p>
            )}
            <SourceBadge p={s.provenance} error={s.ok ? undefined : s.error} />
          </article>
        ))}
        {!sections && <p className="text-sm text-muted">Ładowanie…</p>}
      </div>
    </div>
  );
}
