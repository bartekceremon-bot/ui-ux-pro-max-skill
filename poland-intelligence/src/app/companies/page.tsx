'use client';

import { useState } from 'react';
import Link from 'next/link';
import SourceBadge from '@/components/SourceBadge';
import type { Provenance } from '@/lib/types';

interface Row { title: string; subtitle: string; href: string | null; identifiers: Record<string, string | null>; provenance: Provenance; matchedBy: string }

export default function CompaniesPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [issues, setIssues] = useState<{ source: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setRows((data.candidates ?? []).filter((c: { kind: string }) => c.kind === 'company'));
      setIssues(data.issues ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Company Intelligence</h1>
      <p className="text-sm text-muted">
        Wyszukiwanie podmiotów po NIP, REGON, KRS lub nazwie. Źródła: KRS Open API, CEIDG (wymaga tokenu),
        GUS REGON/BIR1 (wymaga klucza).
      </p>
      <form onSubmit={run} className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="NIP / REGON / KRS / nazwa firmy" />
        <button className="btn-primary" disabled={loading}>{loading ? 'Szukam…' : 'Szukaj'}</button>
      </form>

      {issues.map((i, idx) => (
        <p key={idx} className="text-xs text-warn">{i.source}: {i.message}</p>
      ))}

      {rows?.length === 0 && <p className="text-sm text-muted">Brak podmiotów w dostępnych źródłach.</p>}
      {rows?.map((r, i) => (
        <article key={i} className="card">
          <div className="text-sm font-medium">
            {r.href ? <Link className="hover:underline" href={r.href}>{r.title}</Link> : r.title}
          </div>
          <div className="text-xs text-muted">{r.subtitle} · dopasowanie: {r.matchedBy}</div>
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
            {Object.entries(r.identifiers).map(([k, v]) => (v ? <span key={k}>{k}: {v}</span> : null))}
          </div>
          <SourceBadge p={r.provenance} />
        </article>
      ))}
    </div>
  );
}
