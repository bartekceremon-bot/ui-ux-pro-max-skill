import { NextResponse } from 'next/server';
import { poland360 } from '@/lib/poland360';
import { num, rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const name = p.get('name');
  const missing = requireParam(name, 'name');
  if (missing) return missing;
  const res = await poland360({
    name: name!,
    lat: num(p.get('lat'), 52.2297),
    lon: num(p.get('lon'), 21.0122),
    unitId: p.get('unitId'),
    radiusMeters: num(p.get('radius'), 5000),
  });
  return NextResponse.json(res);
}
