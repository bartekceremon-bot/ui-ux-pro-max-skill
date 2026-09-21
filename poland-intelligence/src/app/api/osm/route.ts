import { NextResponse } from 'next/server';
import * as osm from '@/lib/integrations/osm';
import { num, rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const kind = p.get('kind') ?? 'geocode';

  if (kind === 'reverse') {
    return NextResponse.json(await osm.reverse(num(p.get('lat'), 52.2297), num(p.get('lon'), 21.0122)));
  }
  if (kind === 'poi') {
    const preset = p.get('preset') ?? 'szkoly';
    const res = await osm.poiAround(num(p.get('lat'), 52.2297), num(p.get('lon'), 21.0122), num(p.get('radius'), 5000), preset);
    return NextResponse.json({ ...res, presets: Object.keys(osm.POI_PRESETS) }, { status: res.ok ? 200 : 502 });
  }
  const q = p.get('q');
  const missing = requireParam(q, 'q');
  if (missing) return missing;
  const res = await osm.geocode(q!, num(p.get('limit'), 5));
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
