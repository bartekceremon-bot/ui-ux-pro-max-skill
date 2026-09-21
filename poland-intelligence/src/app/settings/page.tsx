import { GEOPORTAL_SOURCES, SOURCES, hasKey } from '@/lib/sources';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <section className="card overflow-auto">
        <h2 className="card-title">Konektory i konfiguracja</h2>
        <table className="table mt-2">
          <thead><tr><th>Źródło</th><th>Endpoint</th><th>Klucz</th><th>Status</th><th>Dokumentacja</th></tr></thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td className="max-w-[280px] truncate font-mono text-xs text-muted">{s.apiBase}</td>
                <td className="font-mono text-xs text-muted">{s.requiresKey ? s.keyEnv : '—'}</td>
                <td className={hasKey(s.id) ? 'text-ok' : 'text-warn'}>{hasKey(s.id) ? 'skonfigurowane' : 'brak klucza'}</td>
                <td><a className="text-accent hover:underline" href={s.docs} target="_blank" rel="noreferrer">docs</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Sekrety pochodzą wyłącznie ze zmiennych środowiskowych i nigdy nie trafiają do przeglądarki —
          wszystkie wywołania idą przez backend proxy (/api/*).
        </p>
      </section>

      <section className="card overflow-auto">
        <h2 className="card-title">geoportal_sources</h2>
        <table className="table mt-2">
          <thead><tr><th>Nazwa</th><th>Typ</th><th>URL</th><th>Aktywne</th><th>Zweryfikowano</th><th>Uwagi</th></tr></thead>
          <tbody>
            {GEOPORTAL_SOURCES.map((g) => (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td className="text-muted">{g.serviceType}</td>
                <td className="max-w-[260px] truncate font-mono text-xs text-muted">{g.url}</td>
                <td className={g.active ? 'text-ok' : 'text-warn'}>{g.active ? 'tak' : 'nie'}</td>
                <td className="font-mono text-xs text-muted">{g.lastVerified}</td>
                <td className="max-w-[240px] text-xs text-muted">{g.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Endpointy Geoportalu bywają zmieniane — edytuj tę konfigurację (src/lib/sources.ts) bez przebudowy aplikacji.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Prywatność i bezpieczeństwo</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Brak scrapingu i omijania zabezpieczeń — wyłącznie oficjalne, publiczne API.</li>
          <li>Minimalizacja danych osobowych: analizujemy podmioty gospodarcze, nie osoby.</li>
          <li>Rate limiting na warstwie /api oraz cache ograniczający obciążenie publicznych usług.</li>
          <li>Walidacja parametrów wejściowych, brak SQL w warstwie zapytań użytkownika, escapowanie HTML w raportach.</li>
          <li>Sekrety wyłącznie w ENV; klucze nigdy nie są eksponowane klientowi.</li>
        </ul>
      </section>
    </div>
  );
}
