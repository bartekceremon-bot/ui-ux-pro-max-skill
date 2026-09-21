import { NextResponse } from 'next/server';
import * as teryt from '@/lib/integrations/teryt';
import { rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const unitId = p.get('unitId');
  if (unitId) return NextResponse.json(await teryt.get(unitId));
  const name = p.get('name');
  const missing = requireParam(name, 'name');
  if (missing) return missing;
  const res = await teryt.search(name!);
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
