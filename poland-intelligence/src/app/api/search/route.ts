import { NextResponse } from 'next/server';
import { globalSearch } from '@/lib/search';
import { rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const q = new URL(req.url).searchParams.get('q');
  const missing = requireParam(q, 'q');
  if (missing) return missing;
  const result = await globalSearch(q!.slice(0, 200));
  return NextResponse.json(result);
}
