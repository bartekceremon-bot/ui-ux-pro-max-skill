import Link from 'next/link';
import SourceBadge from '@/components/SourceBadge';
import * as nbp from '@/lib/integrations/nbp';
import * as gios from '@/lib/integrations/gios';
import * as openmeteo from '@/lib/integrations/openmeteo';
import { TRANSIT_FEEDS } from '@/lib/integrations/gtfs';
import { DEMO_SEARCHES } from '@/lib/demo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OverviewPage() {
  const [eur, stations, weather] = await Promise.all([
    nbp.series('EUR', 7),
    gios.stations(),
    openmeteo.forecast(52.2297, 21.0122),
  ]);

  const lastEur = eur.data?.rates?.[eur.data.rates.length - 1];
  const temp = weather.data?.current?.['temperature_2m'];
  const activeFeeds = TRANSIT_FEEDS.filter((f) => f.active).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">POLAND INTELLIGENCE</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Jedno miejsce do analizy firm, miejsc, danych publicznych, gospodarki, infrastruktury i środowiska Polski.
          Każda wartość poniżej pochodzi z oficjalnego źródła i jest opisana datą pobrania — nic nie jest generowane.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <div className="card-title">🇵🇱 Kurs EUR/PLN</div>
          <div className="metric">{lastEur ? lastEur.mid.toFixed(4) : 'brak danych'}</div>
          <p className="text-xs text-muted">{lastEur ? `Tabela ${lastEur.no} z ${lastEur.effectiveDate}` : 'Źródło nie odpowiedziało.'}</p>
          <SourceBadge p={eur.provenance} error={eur.error} />
        </article>

        <article className="card">
          <div className="card-title">🌫 Stacje pomiarowe GIOŚ</div>
          <div className="metric">{stations.data?.length ?? '—'}</div>
          <p className="text-xs text-muted">Stacje jakości powietrza dostępne w API v1.</p>
          <SourceBadge p={stations.provenance} error={stations.error} />
        </article>

        <article className="card">
          <div className="card-title">🌡 Pogoda — Warszawa</div>
          <div className="metric">{temp !== undefined ? `${temp} °C` : 'brak danych'}</div>
          <p className="text-xs text-muted">Pomiar bieżący dla 52.2297, 21.0122.</p>
          <SourceBadge p={weather.provenance} error={weather.error} />
        </article>

        <article className="card">
          <div className="card-title">🚌 Aktywne feedy GTFS</div>
          <div className="metric">{activeFeeds} / {TRANSIT_FEEDS.length}</div>
          <p className="text-xs text-muted">Miasta bez zweryfikowanego feedu pokazują „Brak aktywnego feedu”.</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="card-title">Demo — zapytania startowe</h2>
          <p className="mt-2 text-xs text-muted">
            Dane demo pochodzą wyłącznie z API. Nie tworzymy fikcyjnych firm ani statystyk.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {DEMO_SEARCHES.map((d) => (
              <li key={d.query}>
                <Link href={`/search?q=${encodeURIComponent(d.query)}`} className="btn">
                  {d.query}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="card-title">Skróty</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-accent hover:underline" href="/map">🗺 Map Intelligence — mapa pełnoekranowa</Link></li>
            <li><Link className="text-accent hover:underline" href="/locations">📍 Poland 360 — panel lokalizacji</Link></li>
            <li><Link className="text-accent hover:underline" href="/system">🩺 System Health — status 13 źródeł</Link></li>
            <li><Link className="text-accent hover:underline" href="/reports">📑 Generator raportów (JSON / CSV / HTML→PDF)</Link></li>
          </ul>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Zasada systemu</h2>
        <p className="mt-2 text-sm text-muted">
          <strong className="text-ink">Every fact must be traceable to a source.</strong> Brak danych jest pokazywany
          wprost, dane z cache są oznaczone jako CACHED wraz z czasem zapisu, a wnioski analityczne zawsze wymieniają
          rekordy, na których powstały.
        </p>
      </section>
    </div>
  );
}
