'use client';

export interface Point { label: string; value: number }

/** Lekki wykres SVG – bez zewnętrznych bibliotek, czytelny na ciemnym tle. */
export function LineChart({ points, unit = '', height = 160 }: { points: Point[]; unit?: string; height?: number }) {
  if (points.length === 0) return <p className="text-sm text-muted">Brak danych do wykresu.</p>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 600;
  const h = height;
  const pad = 24;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Wykres liniowy">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#222a36" />
        <path d={d} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={p.label + i} cx={x(i)} cy={y(p.value)} r="2.5" fill="#3b82f6" />
        ))}
        <text x={pad} y={14} fill="#8a97a8" fontSize="11">{fmt(max)} {unit}</text>
        <text x={pad} y={h - 6} fill="#8a97a8" fontSize="11">{fmt(min)} {unit}</text>
        <text x={w - pad} y={h - 6} fill="#8a97a8" fontSize="11" textAnchor="end">{points[points.length - 1].label}</text>
        <text x={pad + 60} y={h - 6} fill="#8a97a8" fontSize="11">{points[0].label}</text>
      </svg>
    </figure>
  );
}

export function BarChart({ points, unit = '' }: { points: Point[]; unit?: string }) {
  if (points.length === 0) return <p className="text-sm text-muted">Brak danych do wykresu.</p>;
  const max = Math.max(...points.map((p) => p.value)) || 1;
  return (
    <ul className="mt-2 space-y-1">
      {points.map((p) => (
        <li key={p.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted">{p.label}</span>
          <span className="h-3 rounded-sm bg-accent" style={{ width: `${Math.max((p.value / max) * 100, 1)}%` }} />
          <span className="tabular-nums text-muted">{fmt(p.value)} {unit}</span>
        </li>
      ))}
    </ul>
  );
}

function fmt(v: number) {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 }).format(v);
}
