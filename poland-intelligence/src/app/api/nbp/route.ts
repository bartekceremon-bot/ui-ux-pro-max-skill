import { NextResponse } from 'next/server';
import * as nbp from '@/lib/integrations/nbp';
import { num, rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const days = num(p.get('days'), 30);
  const code = p.get('code');
  if (code === 'GOLD') return NextResponse.json(await nbp.gold(days));
  if (code) return NextResponse.json(await nbp.series(code, days));

  const out = [];
  for (const c of nbp.NBP_MAIN) out.push({ code: c, ...(await nbp.series(c, days)) });
  const goldRes = await nbp.gold(days);
  return NextResponse.json({ currencies: out, gold: goldRes });
}
