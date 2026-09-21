import SourceBadge from '@/components/SourceBadge';
import { LineChart } from '@/components/Chart';
import * as nbp from '@/lib/integrations/nbp';

export const dynamic = 'force-dynamic';

export default async function FinancePage({ searchParams }: { searchParams: { days?: string } }) {
  const days = Math.min(Math.max(Number(searchParams.days ?? 30), 7), 255);
  const results = await Promise.all(nbp.NBP_MAIN.map(async (code) => ({ code, res: await nbp.series(code, days) })));
  const goldRes = await nbp.gold(days);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">NBP / Finance — Polska makro</h1>
          <p className="text-sm text-muted">Kursy średnie z tabeli A oraz cena złota. Źródło: Narodowy Bank Polski.</p>
        </div>
        <nav className="flex gap-2 text-xs">
          {[7, 30, 90, 255].map((d) => (
            <a key={d} href={`/finance?days=${d}`} className={`btn ${d === days ? 'border-accent text-accent' : ''}`}>
              {d === 255 ? 'MAX' : `${d}D`}
            </a>
          ))}
        </nav>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {results.map(({ code, res }) => {
          const rates = res.data?.rates ?? [];
          const last = rates[rates.length - 1];
          const prev = rates[rates.length - 2];
          const change = last && prev ? ((last.mid - prev.mid) / prev.mid) * 100 : null;
          return (
            <article key={code} className="card">
              <div className="flex items-baseline justify-between">
                <h2 className="card-title">{code}/PLN</h2>
                {change !== null && (
                  <span className={change >= 0 ? 'text-xs text-ok' : 'text-xs text-err'}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}% d/d
                  </span>
                )}
              </div>
              <div className="metric">{last ? last.mid.toFixed(4) : 'brak danych'}</div>
              <p className="text-xs text-muted">{last ? `Tabela ${last.no} · data kursu ${last.effectiveDate}` : res.error}</p>
              <LineChart points={rates.map((r) => ({ label: r.effectiveDate.slice(5), value: r.mid }))} unit="PLN" />
              <SourceBadge p={res.provenance} error={res.error} />
            </article>
          );
        })}

        <article className="card">
          <h2 className="card-title">Cena złota (NBP)</h2>
          <div className="metric">
            {goldRes.data?.length ? `${goldRes.data[goldRes.data.length - 1].cena.toFixed(2)} PLN/g` : 'brak danych'}
          </div>
          <LineChart points={(goldRes.data ?? []).map((g) => ({ label: g.data.slice(5), value: g.cena }))} unit="PLN/g" />
          <SourceBadge p={goldRes.provenance} error={goldRes.error} />
        </article>
      </section>
    </div>
  );
}
