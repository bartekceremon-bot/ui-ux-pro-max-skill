import Link from 'next/link';
import SourceBadge from '@/components/SourceBadge';
import WatchButton from '@/components/WatchButton';
import * as krsApi from '@/lib/integrations/krs';
import * as osm from '@/lib/integrations/osm';
import { nearestAirStation } from '@/lib/poland360';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({
  params, searchParams,
}: { params: { krs: string }; searchParams: { rejestr?: string } }) {
  const register = searchParams.rejestr === 'S' ? 'S' : 'P';
  const num = params.krs.replace(/\D/g, '').padStart(10, '0');
  const res = await krsApi.byKrs(num, register);
  const entity = res.data ? krsApi.normalize(res.data, num) : null;

  if (!entity) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold">KRS {num}</h1>
        <div className="card border-err/40">
          <p className="text-sm text-err">{res.error ?? 'Brak danych dla tego numeru KRS w rejestrze przedsiębiorców.'}</p>
          <p className="mt-2 text-xs text-muted">
            Spróbuj rejestru stowarzyszeń: <Link className="text-accent hover:underline" href={`/companies/${num}?rejestr=S`}>rejestr S</Link>.
            Nie generujemy danych zastępczych.
          </p>
          <SourceBadge p={res.provenance} />
        </div>
      </div>
    );
  }

  const addressQuery = [entity.address, entity.postalCode, entity.city].filter(Boolean).join(', ');
  const geo = addressQuery ? await osm.geocode(addressQuery, 1) : null;
  const hit = geo?.data?.[0];
  const air = hit ? await nearestAirStation(Number(hit.lat), Number(hit.lon)) : null;
  const header = res.data?.odpis?.naglowekA;

  return (
    <div className="space-y-5">
      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{entity.name}</h1>
            <p className="text-sm text-muted">{entity.legalForm ?? '—'}</p>
          </div>
          <WatchButton
            item={{ kind: 'company', id: `krs:${num}`, label: entity.name, href: `/companies/${num}`, snapshot: { status: entity.status ?? '', name: entity.name } }}
          />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <Field label="KRS" value={entity.krs} mono />
          <Field label="NIP" value={entity.nip} mono />
          <Field label="REGON" value={entity.regon} mono />
          <Field label="Status danych" value={header?.stanZDnia ? `Stan na ${header.stanZDnia}` : null} />
          <Field label="Data rejestracji" value={header?.dataRejestracjiWKRS ?? null} />
        </dl>
        <SourceBadge p={res.provenance} error={res.error} />
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <h2 className="card-title">Siedziba i adres</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Field label="Adres" value={addressQuery || null} />
            <Field label="Województwo" value={entity.voivodeship} />
            <Field label="Powiat" value={entity.county} />
            <Field label="Gmina" value={entity.municipality} />
          </dl>
          {hit ? (
            <>
              <p className="mt-3 text-xs text-muted">
                Geokodowanie: {Number(hit.lat).toFixed(5)}, {Number(hit.lon).toFixed(5)} —{' '}
                <Link className="text-accent hover:underline" href={`/map?lat=${hit.lat}&lon=${hit.lon}&label=${encodeURIComponent(entity.name)}`}>pokaż na mapie</Link>
                {' · '}
                <Link className="text-accent hover:underline" href={`/locations?name=${encodeURIComponent(entity.city ?? '')}&lat=${hit.lat}&lon=${hit.lon}`}>Poland 360</Link>
              </p>
              {geo && <SourceBadge p={geo.provenance} error={geo.error} />}
            </>
          ) : (
            <p className="mt-3 text-xs text-warn">Nie udało się zgeokodować adresu — nie przypisujemy współrzędnych na podstawie domysłu.</p>
          )}
        </article>

        <article className="card">
          <h2 className="card-title">Przedmiot działalności (PKD)</h2>
          {entity.pkd?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {entity.pkd.slice(0, 20).map((p) => <li key={p} className="text-muted">{p}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Brak danych PKD w odpisie.</p>
          )}
        </article>

        <article className="card">
          <h2 className="card-title">Reprezentacja / organy</h2>
          <Representation odpis={res.data} />
          <p className="mt-2 text-[11px] text-muted">
            Prezentujemy wyłącznie dane rejestrowe podmiotu. Nie budujemy profili osób fizycznych.
          </p>
        </article>

        <article className="card">
          <h2 className="card-title">Kontekst lokalizacji — jakość powietrza</h2>
          {air?.ok ? (
            <>
              <p className="mt-2 text-sm">{air.title}</p>
              <SourceBadge p={air.provenance} error={air.error} />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{air?.error ?? 'Brak współrzędnych — sekcja niedostępna.'}</p>
          )}
        </article>
      </section>

      <section className="card">
        <h2 className="card-title">Timeline (DATE · EVENT · SOURCE)</h2>
        <table className="table mt-3">
          <thead><tr><th>Data</th><th>Zdarzenie</th><th>Źródło</th></tr></thead>
          <tbody>
            {header?.dataRejestracjiWKRS && (
              <tr><td className="font-mono">{header.dataRejestracjiWKRS}</td><td>Rejestracja w KRS</td><td>KRS</td></tr>
            )}
            {header?.stanZDnia && (
              <tr><td className="font-mono">{header.stanZDnia}</td><td>Stan danych w odpisie aktualnym</td><td>KRS</td></tr>
            )}
            <tr>
              <td className="font-mono">{res.provenance.retrievedAt.slice(0, 10)}</td>
              <td>Pobranie danych przez Poland Intelligence ({res.provenance.freshness})</td>
              <td>Poland Intelligence</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Pełna historia wpisów pochodzi z odpisu pełnego:{' '}
          <a className="text-accent hover:underline" href={`/api/krs?krs=${num}&full=1`} target="_blank" rel="noreferrer">/api/krs?full=1</a>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Sources</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          <li><a className="text-accent hover:underline" href={res.provenance.sourceUrl} target="_blank" rel="noreferrer">{res.provenance.source}</a> — pobrano {res.provenance.retrievedAt}</li>
          {geo && <li><a className="text-accent hover:underline" href={geo.provenance.sourceUrl} target="_blank" rel="noreferrer">{geo.provenance.source}</a> — pobrano {geo.provenance.retrievedAt}</li>}
          {air && <li><a className="text-accent hover:underline" href={air.provenance.sourceUrl} target="_blank" rel="noreferrer">{air.provenance.source}</a> — pobrano {air.provenance.retrievedAt}</li>}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value ?? '—'}</dd>
    </div>
  );
}

function Representation({ odpis }: { odpis: krsApi.KrsOdpis | null }) {
  const rep = odpis?.odpis?.dane?.dzial2?.reprezentacja;
  if (!rep?.sklad?.length) return <p className="mt-3 text-sm text-muted">Brak danych o reprezentacji w odpisie.</p>;
  return (
    <table className="table mt-3">
      <thead><tr><th>Funkcja</th><th>Organ</th></tr></thead>
      <tbody>
        {rep.sklad.slice(0, 20).map((m, i) => (
          <tr key={i}><td>{m.funkcjaWOrganie ?? '—'}</td><td className="text-muted">{rep.nazwa ?? '—'}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
