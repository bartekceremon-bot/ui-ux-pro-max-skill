import { NextResponse } from 'next/server';
import { ask } from '@/lib/analyst';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  let body: { question?: string; place?: string; lat?: number; lon?: number; unitId?: string | null; radiusKm?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Nieprawidłowy JSON.' }, { status: 400 });
  }
  const question = (body.question ?? '').toString().slice(0, 500).trim();
  if (!question) return NextResponse.json({ ok: false, error: 'Brak pytania.' }, { status: 400 });
  const answer = await ask(question, {
    place: body.place?.toString().slice(0, 120),
    lat: typeof body.lat === 'number' ? body.lat : undefined,
    lon: typeof body.lon === 'number' ? body.lon : undefined,
    unitId: body.unitId ?? null,
    radiusKm: typeof body.radiusKm === 'number' ? Math.min(Math.max(body.radiusKm, 1), 20) : 5,
  });
  return NextResponse.json(answer);
}
