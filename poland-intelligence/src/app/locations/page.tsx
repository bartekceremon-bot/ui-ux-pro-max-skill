import Link from 'next/link';
import Poland360Panel from '@/components/Poland360Panel';
import * as osm from '@/lib/integrations/osm';
import * as teryt from '@/lib/integrations/teryt';
import { DEMO_SEARCHES } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export default async function LocationsPage({
  searchParams,
}: { searchParams: { name?: string; lat?: string; lon?: string; unitId?: string } }) {
  const name = (searchParams.name ?? '').trim();
  if (!name) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Location Intelligence</h1>
        <p className="text-sm text-muted">
          Wskaż gminę, powiat, miejscowość lub adres, aby otrzymać panel POLAND 360: demografia, gospodarka,
          rynek pracy, mieszkalnictwo, powietrze, pogoda, zdrowie, transport, POI i dane publiczne.
        </p>
        <ul className="flex flex-wrap gap-2">
          {DEMO_SEARCHES.filter((d) => /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(d.query) && !/\d/.test(d.query)).map((d) => (
            <li key={d.query}><Link className="btn" href={`/locations?name=${encodeURIComponent(d.query)}`}>{d.query}</Link></li>
          ))}
        </ul>
      </div>
    );
  }

  let lat = Number(searchParams.lat);
  let lon = Number(searchParams.lon);
  let geoError: string | null = null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const g = await osm.geocode(name, 1);
    const hit = g.data?.[0];
    if (hit) { lat = Number(hit.lat); lon = Number(hit.lon); }
    else geoError = g.error ?? 'Nie udało się zgeokodować lokalizacji.';
  }

  let unitId = searchParams.unitId ?? null;
  if (!unitId) {
    const t = await teryt.search(name);
    unitId = t.data?.[0]?.terytCode ?? null;
  }

  if (geoError) {
    return (
      <div className="card border-err/40">
        <h1 className="text-lg font-semibold">{name}</h1>
        <p className="mt-2 text-sm text-err">{geoError}</p>
        <p className="mt-1 text-xs text-muted">Nie przypisujemy współrzędnych „na oko” — popraw zapytanie lub podaj lat/lon.</p>
      </div>
    );
  }

  return <Poland360Panel name={name} lat={lat} lon={lon} unitId={unitId} />;
}
