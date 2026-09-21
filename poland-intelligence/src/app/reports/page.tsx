'use client';

import { useState } from 'react';

const LOCATION_SECTIONS = [
  'Location', 'Demographics', 'Economy', 'Business', 'Infrastructure', 'Transport',
  'Healthcare', 'Environment', 'Weather', 'OSM POI', 'Sources',
];
const COMPANY_SECTIONS = [
  'Executive Summary', 'Identity', 'Registration', 'Activity', 'Location', 'Local Economy',
  'Infrastructure', 'Transport', 'Air Quality', 'Weather', 'Healthcare', 'Public Data', 'Timeline', 'Sources',
];

export default function ReportsPage() {
  const [name, setName] = useState('Kraków');
  const [unitId, setUnitId] = useState('');
  const [lat, setLat] = useState('50.0614');
  const [lon, setLon] = useState('19.9366');

  const qs = () => {
    const p = new URLSearchParams({ name, lat, lon, radius: '5000' });
    if (unitId) p.set('unitId', unitId);
    return p.toString();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Report Generator</h1>
      <p className="text-sm text-muted">
        Raport zawiera wyłącznie dane pobrane ze źródeł wraz z linkiem i czasem pobrania.
        PDF uzyskasz drukując wersję HTML (Ctrl+P → Zapisz jako PDF).
      </p>

      <section className="card grid gap-3 sm:grid-cols-4">
        <label className="text-xs text-muted">Nazwa miejsca<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-xs text-muted">Jednostka BDL/TERYT<input className="input mt-1" value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="opcjonalnie" /></label>
        <label className="text-xs text-muted">Lat<input className="input mt-1" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label className="text-xs text-muted">Lon<input className="input mt-1" value={lon} onChange={(e) => setLon(e.target.value)} /></label>
        <div className="sm:col-span-4 flex flex-wrap gap-2">
          <a className="btn-primary" href={`/api/report?${qs()}&format=html`} target="_blank" rel="noreferrer">Generuj HTML (→ PDF)</a>
          <a className="btn" href={`/api/report?${qs()}&format=csv`}>CSV</a>
          <a className="btn" href={`/api/report?${qs()}&format=json`} target="_blank" rel="noreferrer">JSON</a>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="card-title">Raport lokalizacji — sekcje</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            {LOCATION_SECTIONS.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </article>
        <article className="card">
          <h2 className="card-title">Raport firmy — sekcje</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            {COMPANY_SECTIONS.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="mt-2 text-xs text-muted">
            Raport firmy generujesz ze strony podmiotu (/companies/&lt;KRS&gt;) — sekcje lokalizacyjne pochodzą
            z panelu Poland 360 dla adresu siedziby.
          </p>
        </article>
      </section>
    </div>
  );
}
