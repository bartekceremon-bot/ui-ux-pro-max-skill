'use client';

import { useCallback, useEffect, useState } from 'react';

interface Connector {
  id: string; label: string; status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNCONFIGURED';
  lastSuccessAt: string | null; lastError: string | null; latencyMs: number | null;
  requests: number; errors: number; errorRate: number; configured: boolean; docs: string | null;
}

const DOT: Record<string, string> = {
  ONLINE: 'text-ok', DEGRADED: 'text-warn', OFFLINE: 'text-err', UNCONFIGURED: 'text-muted',
};

export default function SystemPage() {
  const [rows, setRows] = useState<Connector[]>([]);
  const [checkedAt, setCheckedAt] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (probe: boolean) => {
    setLoading(true);
    try {
      const res = await (await fetch(`/api/health${probe ? '?probe=1' : ''}`)).json();
      setRows(res.connectors ?? []);
      setCheckedAt(res.checkedAt ?? '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">System Health</h1>
        <button className="btn-primary" disabled={loading} onClick={() => void load(true)}>
          {loading ? 'Sprawdzam źródła…' : 'Uruchom pełny health check'}
        </button>
      </div>
      <p className="text-xs text-muted">Sprawdzono: {checkedAt ? checkedAt.replace('T', ' ').slice(0, 19) : '—'}</p>

      <div className="card overflow-auto">
        <table className="table">
          <thead>
            <tr><th>Źródło</th><th>Status</th><th>Ostatni sukces</th><th>Latency</th><th>Error rate</th><th>Konfiguracja</th><th>Ostatni błąd</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.docs ? <a className="text-accent hover:underline" href={c.docs} target="_blank" rel="noreferrer">{c.label}</a> : c.label}
                </td>
                <td><span className={DOT[c.status]}>●</span> {c.status}</td>
                <td className="font-mono text-xs text-muted">{c.lastSuccessAt?.replace('T', ' ').slice(0, 19) ?? '—'}</td>
                <td className="tabular-nums text-muted">{c.latencyMs !== null ? `${c.latencyMs} ms` : '—'}</td>
                <td className="tabular-nums text-muted">{(c.errorRate * 100).toFixed(0)}% ({c.errors}/{c.requests})</td>
                <td className={c.configured ? 'text-ok' : 'text-warn'}>{c.configured ? 'OK' : 'brak klucza'}</td>
                <td className="max-w-[280px] truncate text-xs text-muted">{c.lastError ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Status UNCONFIGURED oznacza brak klucza/tokenu w .env (CEIDG, REGON) — connector istnieje, ale świadomie
        nie zwraca żadnych danych zastępczych.
      </p>
    </div>
  );
}
