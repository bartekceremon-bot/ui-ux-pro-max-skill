import { NextResponse } from 'next/server';
import { poland360, type Poland360 } from '@/lib/poland360';
import { num, rateLimit, requireParam } from '../_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Raport lokalizacji w formatach JSON / CSV / HTML.
 * HTML nadaje się do druku do PDF (Ctrl+P) – nie dodajemy ciężkiej zależności.
 */
export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const name = p.get('name');
  const missing = requireParam(name, 'name');
  if (missing) return missing;
  const format = (p.get('format') ?? 'json').toLowerCase();

  const panel = await poland360({
    name: name!, lat: num(p.get('lat'), 52.2297), lon: num(p.get('lon'), 21.0122),
    unitId: p.get('unitId'), radiusMeters: num(p.get('radius'), 5000),
  });

  if (format === 'csv') {
    return new NextResponse(toCsv(panel), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="raport-${slug(name!)}.csv"`,
      },
    });
  }
  if (format === 'html') {
    return new NextResponse(toHtml(panel), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return NextResponse.json(panel);
}

function toCsv(panel: Poland360): string {
  const rows = [['sekcja', 'status', 'zrodlo', 'link_zrodla', 'pobrano', 'swiezosc', 'blad', 'dane_json']];
  for (const s of panel.sections) {
    rows.push([
      s.title, s.ok ? 'OK' : 'BRAK DANYCH', s.provenance.source, s.provenance.sourceUrl,
      s.provenance.retrievedAt, s.provenance.freshness, s.error ?? '',
      JSON.stringify(s.data ?? null),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function toHtml(panel: Poland360): string {
  const sections = panel.sections.map((s) => `
    <section>
      <h2>${escapeHtml(s.title)}</h2>
      <p class="status ${s.ok ? 'ok' : 'err'}">${s.ok ? 'Dane pobrane' : `Brak danych: ${escapeHtml(s.error ?? 'źródło niedostępne')}`}</p>
      <pre>${escapeHtml(JSON.stringify(s.data, null, 2) ?? 'null').slice(0, 6000)}</pre>
      <p class="src">Źródło: ${escapeHtml(s.provenance.source)} ·
        <a href="${escapeHtml(s.provenance.sourceUrl)}">link</a> ·
        pobrano ${escapeHtml(s.provenance.retrievedAt)} · ${s.provenance.freshness} · ${s.provenance.quality}</p>
    </section>`).join('');

  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>Raport lokalizacji – ${escapeHtml(panel.place.name)}</title>
<style>
 body{font:14px/1.5 system-ui;margin:40px;color:#111}
 h1{font-size:24px;margin-bottom:4px} h2{font-size:16px;margin:24px 0 4px}
 pre{background:#f5f6f8;padding:12px;overflow:auto;max-height:320px;font-size:12px}
 .src{color:#666;font-size:12px} .status.ok{color:#15803d} .status.err{color:#b91c1c}
 section{border-top:1px solid #e5e7eb;padding-top:8px}
</style></head><body>
<h1>Raport lokalizacji – ${escapeHtml(panel.place.name)}</h1>
<p>Współrzędne: ${panel.place.lat}, ${panel.place.lon} · jednostka BDL/TERYT: ${escapeHtml(panel.place.unitId ?? 'nie ustalono')}</p>
<p>Wygenerowano: ${escapeHtml(panel.generatedAt)}. Każda sekcja zawiera źródło i czas pobrania. Dane oznaczone jako CACHED nie są danymi live.</p>
${sections}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raport';
}
