'use client';

import dynamicImport from 'next/dynamic';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GEOPORTAL_SOURCES } from '@/lib/sources';
import type { MapMarker } from '@/components/MapView';
import { POI_PRESETS } from '@/lib/integrations/osm';

const MapView = dynamicImport(() => import('@/components/MapView'), { ssr: false });

export default function MapPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Ładowanie mapy…</p>}>
      <MapWorkspace />
    </Suspense>
  );
}

function MapWorkspace() {
  const params = useSearchParams();
  const lat = Number(params.get('lat') ?? 52.0693);
  const lon = Number(params.get('lon') ?? 19.4803);
  const label = params.get('label');

  const [center, setCenter] = useState<[number, number]>([lat, lon]);
  const [zoom, setZoom] = useState(params.get('lat') ? 12 : 6);
  const [preset, setPreset] = useState('szkoly');
  const [radius, setRadius] = useState(5000);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [status, setStatus] = useState<string>('');

  const loadPoi = useCallback(async () => {
    setStatus('Pobieram dane z OpenStreetMap…');
    const res = await fetch(`/api/osm?kind=poi&lat=${center[0]}&lon=${center[1]}&radius=${radius}&preset=${preset}`);
    const data = await res.json();
    if (!data.ok) {
      setMarkers([]);
      setStatus(data.error ?? 'Źródło chwilowo niedostępne.');
      return;
    }
    const elements = data.data?.elements ?? [];
    setMarkers(elements.map((e: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => ({
      id: `${e.type}/${e.id}`,
      lat: e.lat ?? e.center?.lat ?? 0,
      lon: e.lon ?? e.center?.lon ?? 0,
      title: e.tags?.name ?? `${preset} ${e.id}`,
      type: preset,
      source: data.provenance.source,
      sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      retrievedAt: data.provenance.retrievedAt,
      details: e.tags ?? {},
    })).filter((m: MapMarker) => m.lat && m.lon));
    setStatus(`${elements.length} obiektów · ${data.provenance.freshness} · pobrano ${data.provenance.retrievedAt.slice(0, 16).replace('T', ' ')}`);
  }, [center, preset, radius]);

  useEffect(() => { if (params.get('lat')) void loadPoi(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const geoportal = useMemo(() => GEOPORTAL_SOURCES, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-lg font-semibold">Map Intelligence{label ? ` — ${label}` : ''}</h1>
        <label className="text-xs text-muted">
          Kategoria POI
          <select className="input mt-1" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {Object.keys(POI_PRESETS).map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          Promień (m)
          <input className="input mt-1 w-28" type="number" min={100} max={20000} step={500} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
        </label>
        <button className="btn-primary" onClick={() => void loadPoi()}>Pokaż w promieniu</button>
      </div>

      {status && <p className="text-xs text-muted">{status}</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <MapView
          center={center}
          zoom={zoom}
          markers={markers}
          geoportalSources={geoportal}
          onSelect={setSelected}
          onMoveEnd={(c) => { setCenter([c.lat, c.lon]); setZoom(c.zoom); }}
          className="h-[68vh]"
        />
        <aside className="card h-[68vh] overflow-auto">
          <h2 className="card-title">Side panel</h2>
          {selected ? (
            <div className="mt-2 space-y-2 text-sm">
              <div className="font-medium">{selected.title}</div>
              <div className="text-xs text-muted">Typ: {selected.type}</div>
              <div className="text-xs text-muted">Współrzędne: {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</div>
              <dl className="space-y-1 text-xs">
                {Object.entries(selected.details ?? {}).slice(0, 25).map(([k, v]) => (
                  <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-muted">{k}</dt><dd>{String(v)}</dd></div>
                ))}
              </dl>
              <p className="text-[11px] text-muted">
                Źródło: {selected.source} ·{' '}
                <a className="text-accent hover:underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">link do rekordu</a> ·
                pobrano {selected.retrievedAt.slice(0, 16).replace('T', ' ')}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Kliknij obiekt na mapie, aby zobaczyć jego dane i źródło.</p>
          )}
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="card-title">Warstwy Geoportalu (konfiguracja)</h3>
            <ul className="mt-2 space-y-2 text-[11px] text-muted">
              {geoportal.map((g) => (
                <li key={g.name}>
                  <span className={g.active ? 'text-ok' : 'text-warn'}>●</span> {g.name} — {g.serviceType}
                  <div>zweryfikowano: {g.lastVerified}{g.notes ? ` · ${g.notes}` : ''}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
