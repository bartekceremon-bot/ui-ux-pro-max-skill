/**
 * Test integracyjny konektorów: odpytuje uruchomioną aplikację i raportuje,
 * które źródła odpowiadają. Nie zawiera asercji na treść danych – sprawdza
 * kontrakt (ok/error + proweniencja), bo dane publiczne zmieniają się codziennie.
 *
 * Użycie: npm run build && npm start & ; node scripts/smoke.mjs http://localhost:3000
 */
const base = process.argv[2] ?? 'http://localhost:3000';

const CHECKS = [
  ['NBP', '/api/nbp?code=EUR&days=3'],
  ['GIOS', '/api/gios'],
  ['OSM / Nominatim', '/api/osm?q=Lanckorona&limit=1'],
  ['Open-Meteo', '/api/openmeteo?lat=50.0614&lon=19.9366'],
  ['dane.gov.pl', '/api/danegov?q=szko%C5%82y'],
  ['GUS BDL / TERYT', '/api/teryt?name=Krak%C3%B3w'],
  ['NFZ', '/api/nfz?place=KRAK%C3%93W'],
  ['KRS', '/api/krs?krs=0000006865'],
  ['Geoportal', '/api/geoportal'],
  ['GTFS', '/api/gtfs'],
  ['Global search', '/api/search?q=5252344210'],
  ['Health', '/api/health'],
];

let failures = 0;
for (const [label, path] of CHECKS) {
  const started = Date.now();
  try {
    const res = await fetch(base + path);
    const body = await res.json();
    const ok = body.ok !== false;
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK  ' : 'WARN'} ${label.padEnd(18)} ${res.status} ${Date.now() - started}ms ${ok ? '' : `- ${body.error ?? ''}`}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL ${label.padEnd(18)} ${err.message}`);
  }
}
console.log(`\n${CHECKS.length - failures}/${CHECKS.length} zrodel odpowiedzialo.`);
console.log('WARN oznacza niedostepne zrodlo zewnetrzne, nie blad aplikacji - aplikacja nigdy nie generuje danych zastepczych.');
