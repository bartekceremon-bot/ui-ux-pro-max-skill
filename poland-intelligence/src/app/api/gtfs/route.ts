import { NextResponse } from 'next/server';
import { TRANSIT_FEEDS, probeFeed } from '@/lib/integrations/gtfs';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const city = new URL(req.url).searchParams.get('city');
  if (city) return NextResponse.json(await probeFeed(city));
  return NextResponse.json({ feeds: TRANSIT_FEEDS });
}
