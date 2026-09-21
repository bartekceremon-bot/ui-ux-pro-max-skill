'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readChanges, readWatchlist, removeWatch, type ChangeEvent, type WatchItem } from '@/lib/watchlist';

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [changes, setChanges] = useState<ChangeEvent[]>([]);

  useEffect(() => {
    setItems(readWatchlist());
    setChanges(readChanges());
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Watchlists</h1>
      <p className="text-sm text-muted">
        Obserwuj firmy, gminy, powiaty, województwa i adresy. Zmiany danych są zapisywane jako zdarzenia
        (old value → new value, timestamp, source). Dane watchlisty pozostają w przeglądarce — minimalizujemy
        przechowywanie danych po stronie serwera.
      </p>

      <section className="card">
        <h2 className="card-title">Obserwowane ({items.length})</h2>
        {items.length === 0 && <p className="mt-2 text-sm text-muted">Nic nie jest jeszcze obserwowane.</p>}
        <ul className="mt-2 divide-y divide-line/60">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <Link className="text-accent hover:underline" href={i.href}>{i.label}</Link>
                <div className="text-xs text-muted">{i.kind} · dodano {i.addedAt.slice(0, 16).replace('T', ' ')}</div>
              </div>
              <button className="btn" onClick={() => setItems(removeWatch(i.id))}>Usuń</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">Change detected ({changes.length})</h2>
        {changes.length === 0 && <p className="mt-2 text-sm text-muted">Brak wykrytych zmian.</p>}
        {changes.length > 0 && (
          <table className="table mt-2">
            <thead><tr><th>Obiekt</th><th>Pole</th><th>Było</th><th>Jest</th><th>Kiedy</th><th>Źródło</th></tr></thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs">{c.itemId}</td>
                  <td>{c.field}</td>
                  <td className="text-err">{c.oldValue}</td>
                  <td className="text-ok">{c.newValue}</td>
                  <td className="font-mono text-xs text-muted">{c.timestamp.slice(0, 16).replace('T', ' ')}</td>
                  <td className="text-muted">{c.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
