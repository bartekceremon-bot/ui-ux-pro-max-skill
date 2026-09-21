import { NextResponse } from 'next/server';
import { GEOPORTAL_SOURCES, capabilities } from '@/lib/integrations/geoportal';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const name = new URL(req.url).searchParams.get('name');
  if (name) {
    const res = await capabilities(name);
    return NextResponse.json({ ...res, data: res.data ? String(res.data).slice(0, 4000) : null });
  }
  return NextResponse.json({ sources: GEOPORTAL_SOURCES });
}
