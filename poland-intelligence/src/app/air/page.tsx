'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Provenance } from '@/lib/types';

interface Station { id: number; stationName: string; gegrLat: string; gegrLon: string; distanceKm?: number; city?: { name?: string } }

export default function AirPage() {
  const [place, setPlace] = useState('Kraków');
  const [stations, setStations] = useState<Station[]>([]);
  const [prov, setProv] = useState<Provenance | null>(null);
  const [selected, setSelected] = useState<Station | null>(null);
  const [detail, setDetail] = useState<{ sensors: unknown; index: unknown } | null>(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setStatus('Szukam lokalizacji…');
    const geo = await (await fetch(`/api/osm?q=${encodeURIComponent(place)}&limit=1`)).json();
    const hit = geo.data?.[0];
    if (!hit) { setStatus('Nie znaleziono lokalizacji (Nominatim).'); return; }
    setStatus('Pobieram stacje GIOŚ…');
    const res = await (await fetch(`/api/gios?lat=${hit.lat}&lon=${hit.lon}&radiusKm=60`)).json();
    setStations(res.data ?? []);
    setProv(res.provenance ?? null);
    setStatus(res.ok ? `${res.data?.length ?? 0} stacji w promieniu 60 km` : (res.error ?? 'Źródło niedostępne'));
  }, [place]);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function openStation(s: Station) {
    setSelected(s);
    setDetail(null);
    const res = await (await fetch(`/api/gios?stationId=${s.id}`)).json();
    setDetail(res);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Air Quality — GIOŚ</h1>
      <p className="text-sm text-muted">
        Dane z API GIOŚ v1 (<span className="font-mono">/pjp-api/v1/rest/…</span>). Wycofane endpointy nie są używane.
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <input className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Miejscowość" />
        <button className="btn-primary">Szukaj stacji</button>
      </form>
      <p className="text-xs text-muted">{status}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card max-h-[60vh] overflow-auto">
          <h2 className="card-title">Stacje pomiarowe</h2>
          <table className="table mt-2">
            <thead><tr><th>Stacja</th><th>Odległość</th><th /></tr></thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.id}>
                  <td>{s.stationName}</td>
                  <td className="tabular-nums text-muted">{s.distanceKm ? `${s.distanceKm.toFixed(1)} km` : '—'}</td>
                  <td><button className="btn" onClick={() => void openStation(s)}>Pomiary</button></td>
                </tr>
              ))}
              {stations.length === 0 && <tr><td colSpan={3} className="text-muted">Brak stacji do wyświetlenia.</td></tr>}
            </tbody>
          </table>
          {prov && (
            <p className="mt-2 text-[11px] text-muted">
              Źródło: <a className="text-accent hover:underline" href={prov.sourceUrl} target="_blank" rel="noreferrer">{prov.source}</a> ·
              {' '}{prov.freshness} · pobrano {prov.retrievedAt.slice(0, 16).replace('T', ' ')}
            </p>
          )}
        </section>

        <section className="card max-h-[60vh] overflow-auto">
          <h2 className="card-title">{selected ? `Stacja: ${selected.stationName}` : 'Wybierz stację'}</h2>
          {selected && !detail && <p className="mt-2 text-sm text-muted">Pobieram stanowiska i indeks…</p>}
          {detail && (
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-muted">
              {JSON.stringify(detail, null, 2).slice(0, 8000)}
            </pre>
          )}
          <p className="mt-2 text-[11px] text-muted">
            Surowa odpowiedź źródła jest pokazana świadomie — nie interpretujemy wskaźników bez dokumentacji pola.
          </p>
        </section>
      </div>
    </div>
  );
}
