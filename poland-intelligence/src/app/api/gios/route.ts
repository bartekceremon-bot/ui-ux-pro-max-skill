import { NextResponse } from 'next/server';
import * as gios from '@/lib/integrations/gios';
import { num, rateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const stationId = p.get('stationId');
  const sensorId = p.get('sensorId');
  if (sensorId) return NextResponse.json(await gios.measurements(Number(sensorId)));
  if (stationId) {
    const [sensors, index] = await Promise.all([
      gios.sensors(Number(stationId)), gios.airIndex(Number(stationId)),
    ]);
    return NextResponse.json({ sensors, index });
  }
  const res = await gios.stations();
  const lat = p.get('lat');
  const lon = p.get('lon');
  if (lat && lon && res.data) {
    const radiusKm = num(p.get('radiusKm'), 50);
    const { haversine } = await import('@/lib/poland360');
    const filtered = res.data
      .map((s) => ({ ...s, distanceKm: haversine(Number(lat), Number(lon), Number(s.gegrLat), Number(s.gegrLon)) }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return NextResponse.json({ ...res, data: filtered });
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 502 });
}
