'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
      <form
        className="flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Szukaj firmy, NIP, REGON, KRS, adresu, miejscowości…"
          aria-label="Wyszukiwarka globalna"
        />
      </form>
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/system" className="btn" title="Status źródeł">🔔</Link>
        <Link href="/watchlist" className="btn" title="Obserwowane">⭐</Link>
        <Link href="/settings" className="btn" title="Ustawienia">⚙</Link>
      </div>
    </header>
  );
}
