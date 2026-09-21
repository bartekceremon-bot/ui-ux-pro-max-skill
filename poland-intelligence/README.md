# POLAND INTELLIGENCE

**Jedno miejsce do analizy firm, miejsc, danych publicznych, gospodarki, infrastruktury i środowiska Polski.**

Działająca aplikacja (Next.js 14 + TypeScript + Tailwind + MapLibre) z backendowymi
konektorami do 13 oficjalnych źródeł danych publicznych, cache, wyszukiwarką globalną,
mapą, dashboardami, generatorem raportów i monitorem zdrowia API.

> Zasada systemu: **Every fact must be traceable to a source.**
> Aplikacja nigdy nie generuje danych zastępczych. Brak danych jest pokazywany wprost,
> dane z cache są oznaczone jako `CACHED` wraz z czasem zapisu.

---

## Szybki start

```bash
npm install
cp .env.example .env      # uzupełnij klucze tam, gdzie są wymagane
npm run dev               # http://localhost:3000
```

Produkcyjnie:

```bash
npm run build && npm start
npm run smoke             # test integracyjny konektorów na działającej instancji
```

Wymagania: Node.js 18.17+ (zalecane 20/22). Baza danych i Redis są **opcjonalne** —
bez nich aplikacja działa z cache w pamięci procesu, a watchlista żyje w przeglądarce.

## Klucze API

| Źródło | Klucz | Wymagany |
|---|---|---|
| KRS, NBP, GIOŚ, NFZ, dane.gov.pl, Open-Meteo, OSM, Geoportal | — | nie |
| GUS BDL | `GUS_CLIENT_ID` (X-ClientId) | nie (podnosi limity) |
| CEIDG v3 | `CEIDG_JWT` | tak |
| GUS REGON (BIR1) | `GUS_REGON_KEY` | tak |

Konektor bez klucza zwraca jawny status `UNCONFIGURED` i **nie** podstawia danych zastępczych.

## Architektura

```
src/
├── app/
│   ├── api/<konektor>/route.ts   # backend proxy – klucze nigdy nie trafiają do przeglądarki
│   ├── api/search|poland360|analyst|report|health
│   └── <strony>/page.tsx         # Overview, Search, Companies, Map, Economy, Finance,
│                                 # Air, Healthcare, Transport, Public Data, Locations,
│                                 # Reports, Watchlist, System Health, Settings
├── components/                   # Sidebar, TopBar, MapView (MapLibre), Chart, SourceBadge,
│                                 # Poland360Panel, AskPanel, WatchButton
└── lib/
    ├── http.ts                   # jedno wejście do świata zewnętrznego: cache + timeout +
    │                             # health + PROWENIENCJA każdej wartości
    ├── cache.ts, health.ts, sources.ts, detect.ts, types.ts
    ├── search.ts                 # global search + entity resolution
    ├── poland360.ts              # panel łączący wszystkie źródła dla lokalizacji
    ├── analyst.ts                # deterministyczny analityk (odpowiedzi tylko z danych)
    └── integrations/             # krs, ceidg, regon, teryt, bdl, danegov, nbp,
                                  # geoportal, gios, nfz, gtfs, osm, openmeteo
prisma/schema.prisma              # schemat produkcyjny PostgreSQL (+PostGIS)
scripts/smoke.mjs                 # test integracyjny konektorów
```

Każdy konektor udostępnia `search()` / `get()` / `normalize()` / `healthCheck()`,
a cache i rejestrowanie zdrowia są wspólne (`fetchSourced`).

## Źródła danych

| Źródło | Zakres | Endpoint (konfigurowalny w ENV) |
|---|---|---|
| KRS | odpis aktualny/pełny, dane podmiotu, reprezentacja, PKD | `api-krs.ms.gov.pl/api/krs` |
| CEIDG | firmy po NIP/REGON/nazwie, status, PKD, adres | `dane.biznes.gov.pl/api/ceidg/v3` |
| GUS REGON (BIR1) | wyszukiwanie po NIP/REGON/KRS (SOAP) | `wyszukiwarkaregon.stat.gov.pl` |
| TERYT / BDL units | jednostki terytorialne jako warstwa referencyjna | `bdl.stat.gov.pl/api/v1` |
| GUS BDL | demografia, gospodarka, rynek pracy, mieszkalnictwo (10 lat) | `bdl.stat.gov.pl/api/v1` |
| dane.gov.pl | katalog danych publicznych, metadane, zasoby | `api.dane.gov.pl/1.4` |
| NBP | kursy tabeli A, złoto, szeregi 7D/30D/1Y/MAX | `api.nbp.pl/api` |
| Geoportal | WMS/WMTS: ortofoto, PRG, adresy, działki, budynki | konfiguracja `geoportal_sources` |
| GIOŚ | stacje, stanowiska, pomiary, indeks jakości powietrza (**API v1**) | `api.gios.gov.pl/pjp-api/v1/rest` |
| NFZ | świadczeniodawcy, umowy, terminy leczenia | `api.nfz.gov.pl` |
| GTFS | konfiguracja feedów miast (static + realtime) | `src/lib/integrations/gtfs.ts` |
| OpenStreetMap | Nominatim (geokodowanie) + Overpass (POI w promieniu) | `nominatim.openstreetmap.org`, `overpass-api.de` |
| Open-Meteo | pomiar bieżący, prognoza godzinowa i dzienna | `api.open-meteo.com/v1` |

**Geoportal** ma osobną konfigurację (`GEOPORTAL_SOURCES` w `src/lib/sources.ts`):
`name`, `serviceType`, `url`, `active`, `lastVerified`, `notes` — endpoint można zmienić
bez przebudowy aplikacji. Zakładka *Settings* pokazuje tę konfigurację w UI.

## Funkcje

- **Global Search** — automatyczne rozpoznanie NIP (suma kontrolna), REGON, KRS, kodu
  pocztowego, współrzędnych, TERYT, adresu, miejscowości i nazwy firmy.
- **Entity resolution** — priorytet `NIP > REGON > KRS > adres/nazwa > fuzzy`. Przy
  niejednoznacznym dopasowaniu rekordy **nie są scalane** — pokazywani są kandydaci.
- **Company Intelligence** — dane rejestrowe, PKD, reprezentacja, lokalizacja, timeline
  (DATE · EVENT · SOURCE), sekcja Sources.
- **Location Intelligence / POLAND 360** — jeden panel łączący BDL, GIOŚ, NFZ, OSM, NBP,
  Open-Meteo, dane.gov.pl i GTFS dla wskazanego miejsca.
- **Map Intelligence** — MapLibre GL, warstwa OSM + przełączane warstwy WMS Geoportalu,
  POI z Overpass w zadanym promieniu, panel boczny z danymi i linkiem do rekordu źródłowego.
- **Ask Poland Intelligence** — odpowiedzi budowane wyłącznie z pobranych rekordów, zawsze
  z listą źródeł, `Data as of` i `Confidence`; przy braku danych: *„Brak wystarczających
  danych do odpowiedzi.”*
- **Reports** — JSON / CSV / HTML (HTML drukuje się do PDF), każda sekcja z proweniencją.
- **Watchlist + change detection** — `old value → new value`, timestamp, source.
- **System Health** — status ONLINE / DEGRADED / OFFLINE / UNCONFIGURED, ostatni sukces,
  latency i error rate dla 13 konektorów.

## Jakość danych

Każda wartość niesie: `source`, `sourceUrl`, `retrievedAt`, `sourceUpdatedAt`, `recordId`,
`freshness` (`LIVE` / `RECENT` / `CACHED` / `HISTORICAL`) i `quality`
(`OFFICIAL` / `COMMUNITY` / `DERIVED`). Gdy źródło nie odpowiada, aplikacja pokazuje
„Źródło chwilowo niedostępne” i ewentualną kopię oznaczoną `CACHED` z czasem zapisu.

## Prywatność i bezpieczeństwo

- Wyłącznie oficjalne, publiczne API — bez scrapingu i obchodzenia zabezpieczeń.
- Minimalizacja danych osobowych: analizujemy podmioty gospodarcze, nie budujemy profili osób.
- Wszystkie wywołania przez backend proxy (`/api/*`); sekrety tylko w ENV.
- Rate limiting per IP, walidacja parametrów, escapowanie HTML w raportach, cache
  ograniczający obciążenie publicznych usług (Nominatim/Overpass — bez zapytań masowych).
- Schemat produkcyjny zawiera `audit_logs`, `api_logs`, `sync_jobs`, RBAC (`users.role`).

## Baza danych (opcjonalna, produkcyjna)

```bash
createdb poland_intelligence
psql poland_intelligence -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
npm run prisma:push
```

Każda tabela źródłowa ma `source`, `source_url`, `retrieved_at`, `source_updated_at`,
`raw_data_hash`. Geometrie: `geo_features.geojson` + kolumna PostGIS dodawana migracją.

## Status integracji

Zaimplementowane fazy 1–7 w warstwie aplikacyjnej. Ograniczenia, które warto znać:

- **CEIDG** i **REGON/BIR1** wymagają kluczy — bez nich wracają `UNCONFIGURED`.
- **TERYT**: pełne API GUS TERYT to SOAP z kontem; identyfikatory jednostek pobieramy z BDL
  (zgodne z TERYT), co jest widoczne w proweniencji każdego rekordu.
- **GTFS**: pobieranie i parsowanie pełnych archiwów rozkładowych wymaga workera/cronu;
  w repo jest konfiguracja feedów i sprawdzanie dostępności pliku.
- Feedy GTFS oznaczone `active: false` czekają na weryfikację adresu — UI pokazuje wtedy
  „Brak aktywnego feedu”, zgodnie z zasadą braku danych zmyślonych.
