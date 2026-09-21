import { NextResponse } from 'next/server';
import * as regon from '@/lib/integrations/regon';
import { rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const kind = (p.get('kind') ?? 'nip') as 'nip' | 'regon' | 'krs';
  const value = p.get('value');
  const missing = requireParam(value, 'value');
  if (missing) return missing;
  const res = await regon.searchBy(kind, value!.replace(/\D/g, ''));
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
