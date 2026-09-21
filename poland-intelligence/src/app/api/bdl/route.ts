import { NextResponse } from 'next/server';
import * as bdl from '@/lib/integrations/bdl';
import { num, rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  if (p.get('variables') === 'list') return NextResponse.json({ variables: bdl.BDL_VARIABLES });

  const unitId = p.get('unitId');
  const missing = requireParam(unitId, 'unitId');
  if (missing) return missing;

  const variableId = p.get('variableId');
  const years = num(p.get('years'), 10);

  if (variableId) {
    const res = await bdl.variableForUnit(Number(variableId), unitId!, years);
    return NextResponse.json(res, { status: res.ok ? 200 : 502 });
  }

  const series = [];
  for (const v of bdl.BDL_VARIABLES) {
    const res = await bdl.variableForUnit(v.variableId, unitId!, years);
    series.push({
      key: v.key, label: v.label, unit: v.unit, group: v.group,
      ok: res.ok, values: res.data?.results?.[0]?.values ?? null,
      error: res.error, provenance: res.provenance,
    });
  }
  return NextResponse.json({ unitId, series });
}
