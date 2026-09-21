import { NextResponse } from 'next/server';
import * as openmeteo from '@/lib/integrations/openmeteo';
import { num, rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const res = await openmeteo.forecast(num(p.get('lat'), 52.2297), num(p.get('lon'), 21.0122));
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
