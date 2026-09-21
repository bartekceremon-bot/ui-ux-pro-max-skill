import Link from 'next/link';
import SourceBadge from '@/components/SourceBadge';
import { globalSearch } from '@/lib/search';
import { DEMO_SEARCHES } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim();
  if (!q) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Global Search</h1>
        <p className="text-sm text-muted">
          Wpisz nazwę firmy, NIP, REGON, KRS, adres, kod pocztowy, miejscowość, kod TERYT lub współrzędne.
          System sam rozpozna typ zapytania i odpyta właściwe źródła.
        </p>
        <ul className="flex flex-wrap gap-2">
          {DEMO_SEARCHES.map((d) => (
            <li key={d.query}><Link href={`/search?q=${encodeURIComponent(d.query)}`} className="btn">{d.query}</Link></li>
          ))}
        </ul>
      </div>
    );
  }

  const res = await globalSearch(q);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold">Wyniki dla „{q}”</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {res.detected.map((d) => (
            <span key={d.kind} className="rounded border border-line bg-panel px-2 py-1 text-muted">
              <span className="text-ink">{d.kind}</span> · {d.confidence} · {d.reason}
            </span>
          ))}
        </div>
      </header>

      <section className="card">
        <h2 className="card-title">Entity resolution</h2>
        <p className="mt-2 text-sm">{res.mergeNote}</p>
        {res.merged && (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">Nazwa</dt><dd>{res.merged.name || '—'}</dd></div>
            <div><dt className="text-muted">NIP</dt><dd className="font-mono">{res.merged.nip ?? '—'}</dd></div>
            <div><dt className="text-muted">REGON</dt><dd className="font-mono">{res.merged.regon ?? '—'}</dd></div>
            <div><dt className="text-muted">KRS</dt><dd className="font-mono">{res.merged.krs ?? '—'}</dd></div>
          </dl>
        )}
        <p className="mt-2 text-xs text-muted">Priorytet dopasowania: NIP &gt; REGON &gt; KRS &gt; adres/nazwa &gt; dopasowanie rozmyte.</p>
      </section>

      {res.issues.length > 0 && (
        <section className="card border-warn/40">
          <h2 className="card-title text-warn">Źródła, które nie odpowiedziały</h2>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {res.issues.map((i, idx) => (
              <li key={`${i.source}-${idx}`}><span className="text-ink">{i.source}:</span> {i.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="card-title">Kandydaci ({res.candidates.length})</h2>
        {res.candidates.length === 0 && <p className="text-sm text-muted">Brak wyników w dostępnych źródłach.</p>}
        {res.candidates.map((c, i) => (
          <article key={`${c.title}-${i}`} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-ink">
                  {c.href ? <Link href={c.href} className="hover:underline">{c.title}</Link> : c.title}
                </div>
                <div className="text-xs text-muted">{c.subtitle}</div>
              </div>
              <span className="rounded border border-line px-2 py-0.5 text-[11px] text-muted">
                {c.kind} · {c.confidence} · {c.matchedBy}
              </span>
            </div>
            {Object.entries(c.identifiers).some(([, v]) => v) && (
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
                {Object.entries(c.identifiers).map(([k, v]) => (v ? <span key={k}>{k}: {v}</span> : null))}
              </div>
            )}
            <SourceBadge p={c.provenance} />
          </article>
        ))}
      </section>
    </div>
  );
}
