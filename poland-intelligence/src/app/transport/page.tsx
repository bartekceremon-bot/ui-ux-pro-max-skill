import { TRANSIT_FEEDS } from '@/lib/integrations/gtfs';

export const dynamic = 'force-dynamic';

export default function TransportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Transport Intelligence — GTFS</h1>
      <p className="text-sm text-muted">
        Moduł jest uniwersalny: feed to konfiguracja (miasto, przewoźnik, GTFS static, GTFS Realtime).
        Miasta bez zweryfikowanego feedu pokazują „Brak aktywnego feedu” — nie generujemy danych rozkładowych.
      </p>
      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr><th>Miasto</th><th>Przewoźnik</th><th>GTFS static</th><th>GTFS Realtime</th><th>Status</th><th>Zweryfikowano</th></tr>
          </thead>
          <tbody>
            {TRANSIT_FEEDS.map((f) => (
              <tr key={f.city}>
                <td>{f.city}</td>
                <td className="text-muted">{f.agency}</td>
                <td className="max-w-[260px] truncate text-muted">
                  {f.gtfsUrl ? <a className="text-accent hover:underline" href={f.gtfsUrl} target="_blank" rel="noreferrer">{f.gtfsUrl}</a> : '—'}
                </td>
                <td className="max-w-[200px] truncate text-muted">{f.gtfsRtUrl ?? '—'}</td>
                <td className={f.active ? 'text-ok' : 'text-warn'}>{f.active ? 'ACTIVE' : 'Brak aktywnego feedu'}</td>
                <td className="font-mono text-muted">{f.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Sprawdzenie dostępności pliku: <span className="font-mono">/api/gtfs?city=Kraków</span>. Obsługiwane encje GTFS:
        agency, routes, trips, stops, stop_times, calendar, shapes oraz GTFS-RT: vehicle positions, trip updates, alerts.
      </p>
    </div>
  );
}
