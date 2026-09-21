import { NextResponse } from 'next/server';
import { errorRate, healthSnapshot } from '@/lib/health';
import { SOURCES, hasKey } from '@/lib/sources';
import { cacheStats } from '@/lib/cache';
import * as krs from '@/lib/integrations/krs';
import * as ceidg from '@/lib/integrations/ceidg';
import * as regon from '@/lib/integrations/regon';
import * as teryt from '@/lib/integrations/teryt';
import * as bdl from '@/lib/integrations/bdl';
import * as danegov from '@/lib/integrations/danegov';
import * as nbp from '@/lib/integrations/nbp';
import * as geoportal from '@/lib/integrations/geoportal';
import * as gios from '@/lib/integrations/gios';
import * as nfz from '@/lib/integrations/nfz';
import * as gtfs from '@/lib/integrations/gtfs';
import * as osm from '@/lib/integrations/osm';
import * as openmeteo from '@/lib/integrations/openmeteo';
import { rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CHECKS: Record<string, () => Promise<{ ok: boolean; error?: string }>> = {
  krs: krs.healthCheck, ceidg: ceidg.healthCheck, regon: regon.healthCheck,
  teryt: teryt.healthCheck, bdl: bdl.healthCheck, danegov: danegov.healthCheck,
  nbp: nbp.healthCheck, geoportal: geoportal.healthCheck, gios: gios.healthCheck,
  nfz: nfz.healthCheck, gtfs: gtfs.healthCheck, osm: osm.healthCheck,
  openmeteo: openmeteo.healthCheck,
};

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const probe = new URL(req.url).searchParams.get('probe') === '1';

  if (probe) {
    await Promise.all(
      SOURCES.map(async (s) => {
        const check = CHECKS[s.id];
        if (!check) return;
        try { await check(); } catch { /* health module records the failure */ }
      }),
    );
  }

  const snapshot = healthSnapshot().map((h) => ({
    ...h,
    errorRate: Number(errorRate(h).toFixed(3)),
    configured: hasKey(h.id),
    docs: SOURCES.find((s) => s.id === h.id)?.docs ?? null,
  }));

  return NextResponse.json({ checkedAt: new Date().toISOString(), cache: cacheStats(), connectors: snapshot });
}
