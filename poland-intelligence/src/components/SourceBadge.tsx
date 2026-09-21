import type { Provenance } from '@/lib/types';

const FRESHNESS_STYLE: Record<string, string> = {
  LIVE: 'text-ok border-ok/40',
  RECENT: 'text-ok border-ok/40',
  CACHED: 'text-warn border-warn/40',
  HISTORICAL: 'text-muted border-line',
};

/** Każda wartość w aplikacji musi dać się doprowadzić do źródła. */
export default function SourceBadge({ p, error }: { p: Provenance; error?: string }) {
  return (
    <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 ${FRESHNESS_STYLE[p.freshness] ?? 'border-line'}`}>{p.freshness}</span>
        <span className="rounded border border-line px-1.5 py-0.5">{p.quality}</span>
        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {p.source}
        </a>
      </div>
      <div>
        Pobrano: <span className="font-mono">{fmt(p.retrievedAt)}</span>
        {p.sourceUpdatedAt ? <> · Aktualizacja źródła: <span className="font-mono">{fmt(p.sourceUpdatedAt)}</span></> : null}
        {p.recordId ? <> · ID: <span className="font-mono">{p.recordId}</span></> : null}
      </div>
      {p.note ? <div className="text-warn">{p.note}</div> : null}
      {error ? <div className="text-err">{error}</div> : null}
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return iso;
  }
}
