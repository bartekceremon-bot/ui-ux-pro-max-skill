import { NextResponse } from 'next/server';
import * as krs from '@/lib/integrations/krs';
import { rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const number = p.get('krs');
  const missing = requireParam(number, 'krs');
  if (missing) return missing;
  const register = (p.get('rejestr') === 'S' ? 'S' : 'P') as 'P' | 'S';
  const full = p.get('full') === '1';
  const res = full ? await krs.fullExtract(number!, register) : await krs.byKrs(number!, register);
  const entity = res.data ? krs.normalize(res.data, number!.replace(/\D/g, '').padStart(10, '0')) : null;
  return NextResponse.json({ ...res, entity }, { status: res.ok ? 200 : 502 });
}
