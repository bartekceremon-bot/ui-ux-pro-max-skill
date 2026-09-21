import { NextResponse } from 'next/server';
import * as ceidg from '@/lib/integrations/ceidg';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const res = await ceidg.search({
    nip: p.get('nip') ?? undefined,
    regon: p.get('regon') ?? undefined,
    nazwa: p.get('nazwa') ?? undefined,
  });
  const entities = res.data?.firmy?.map(ceidg.normalize) ?? null;
  return NextResponse.json({ ...res, entities }, { status: res.ok ? 200 : 502 });
}
