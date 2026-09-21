'use client';

import { useState } from 'react';

interface Answer {
  question: string;
  answer: string[];
  sources: { label: string; url: string; retrievedAt: string; freshness: string }[];
  dataAsOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  insufficient: boolean;
}

const EXAMPLES = [
  'Jak zmieniała się liczba mieszkańców tej gminy?',
  'Jak wygląda infrastruktura w promieniu 5 km?',
  'Jak zmieniło się bezrobocie w ostatnich 10 latach?',
  'Jak wygląda jakość powietrza?',
];

/** Odpowiedzi budowane wyłącznie z pobranych rekordów – z listą źródeł. */
export default function AskPanel({
  place, lat, lon, unitId, radiusKm = 5,
}: { place: string; lat?: number; lon?: number; unitId?: string | null; radiusKm?: number }) {
  const [q, setQ] = useState(EXAMPLES[0]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(question = q) {
    setQ(question);
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, place, lat, lon, unitId, radiusKm }),
      });
      setAnswer(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Ask Poland Intelligence</h2>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zadaj pytanie o te dane" />
        <button className="btn-primary" disabled={loading}>{loading ? 'Analizuję…' : 'Zapytaj'}</button>
      </form>
      <ul className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => <li key={e}><button className="btn text-xs" onClick={() => void ask(e)}>{e}</button></li>)}
      </ul>

      {answer && (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <div>
            <div className="card-title">Answer</div>
            {answer.insufficient ? (
              <p className="mt-1 text-sm text-warn">Brak wystarczających danych do odpowiedzi.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {answer.answer.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            )}
          </div>
          <div className="text-xs text-muted">
            <div className="card-title">Sources</div>
            <ul className="mt-1 space-y-0.5">
              {answer.sources.map((s, i) => (
                <li key={i}>
                  [<a className="text-accent hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>] ·
                  {' '}{s.freshness} · pobrano {s.retrievedAt.slice(0, 16).replace('T', ' ')}
                </li>
              ))}
              {answer.sources.length === 0 && <li>Brak źródeł — brak odpowiedzi.</li>}
            </ul>
          </div>
          <p className="text-xs text-muted">
            Data as of: <span className="font-mono">{answer.dataAsOf.slice(0, 16).replace('T', ' ')}</span> ·
            Confidence: <span className={answer.confidence === 'HIGH' ? 'text-ok' : answer.confidence === 'MEDIUM' ? 'text-warn' : 'text-err'}>{answer.confidence}</span>
          </p>
          <p className="text-[11px] text-muted">
            Wnioski są wyliczane z rekordów wymienionych powyżej. Nie są faktem urzędowym i nie zastępują źródła.
          </p>
        </div>
      )}
    </section>
  );
}
