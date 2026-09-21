import { NextResponse } from 'next/server';
import * as nfz from '@/lib/integrations/nfz';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  if (p.get('kind') === 'queues') {
    return NextResponse.json(await nfz.queues({
      province: p.get('province') ?? undefined,
      benefit: p.get('benefit') ?? undefined,
      locality: p.get('locality') ?? undefined,
    }));
  }
  const res = await nfz.providers({
    name: p.get('name') ?? undefined,
    place: p.get('place')?.toUpperCase() ?? undefined,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
