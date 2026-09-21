import Poland360Panel from '@/components/Poland360Panel';
import * as teryt from '@/lib/integrations/teryt';
import * as osm from '@/lib/integrations/osm';

export const dynamic = 'force-dynamic';

export default async function UnitPage({ params }: { params: { unitId: string } }) {
  const t = await teryt.get(params.unitId);
  if (!t.ok || !t.data) {
    return (
      <div className="card border-err/40">
        <h1 className="text-lg font-semibold">Jednostka {params.unitId}</h1>
        <p className="mt-2 text-sm text-err">{t.error ?? 'Brak jednostki o tym identyfikatorze w GUS BDL.'}</p>
      </div>
    );
  }
  const g = await osm.geocode(t.data.name, 1);
  const hit = g.data?.[0];
  if (!hit) {
    return (
      <div className="card border-warn/40">
        <h1 className="text-lg font-semibold">{t.data.name}</h1>
        <p className="mt-2 text-sm text-warn">Nie udało się ustalić współrzędnych jednostki (Nominatim).</p>
      </div>
    );
  }
  return <Poland360Panel name={t.data.name} lat={Number(hit.lat)} lon={Number(hit.lon)} unitId={t.data.terytCode} />;
}
