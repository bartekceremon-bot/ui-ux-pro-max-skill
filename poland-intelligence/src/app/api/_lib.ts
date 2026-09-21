import { NextResponse } from 'next/server';

const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);

/** Proste rate limiting per IP – chroni publiczne API źródeł przed nadużyciem. */
export function rateLimit(req: Request): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return null;
  }
  entry.count += 1;
  if (entry.count > LIMIT) {
    return NextResponse.json({ ok: false, error: 'Przekroczono limit zapytań (rate limit).' }, { status: 429 });
  }
  return null;
}

export function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function requireParam(v: string | null, name: string): NextResponse | null {
  if (!v || !v.trim()) {
    return NextResponse.json({ ok: false, error: `Brak wymaganego parametru: ${name}` }, { status: 400 });
  }
  return null;
}

export const runtime = 'nodejs';
