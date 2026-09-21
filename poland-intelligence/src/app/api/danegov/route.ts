import { NextResponse } from 'next/server';
import * as danegov from '@/lib/integrations/danegov';
import { num, rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const id = p.get('id');
  if (id) {
    const [ds, resources] = await Promise.all([danegov.dataset(id), danegov.datasetResources(id)]);
    return NextResponse.json({ dataset: ds, resources });
  }
  const q = p.get('q');
  const missing = requireParam(q, 'q');
  if (missing) return missing;
  const res = await danegov.searchDatasets(q!, num(p.get('page'), 1));
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
