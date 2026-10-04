// End-to-end test with a *real* camera pipeline: Chromium plays a synthetic
// .y4m video as its webcam (tests/synth.py), the app runs the actual model in
// the browser, tracks, counts -- and we compare with ground truth.
//
//   python tests/synth.py video --scene boards_end            (+ --static --zoom 1 for freeze)
//   node web/tests/e2e.mjs --url http://127.0.0.1:8000 --scene boards_end --engine cv
//
// Checks
//   live:   unique count after the camera panned right and back ~= distinct objects
//           in the clip  (no double counting while the camera moves)
//   freeze: POLICZ on a still scene ~= objects fully in view
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? '1' : arr[i + 1]]] : a), []));
const here = dirname(fileURLToPath(import.meta.url));
const vids = resolve(here, '../../tests/out/video');
const url = args.url ?? 'http://127.0.0.1:8000';
const scene = args.scene ?? 'boards_end';
const engine = args.engine ?? 'auto'; // auto | cv | <modelId>
const preset = args.preset ?? ({ boards_end: 'boards', boards_side: 'boards', boxes: 'boxes', pipes: 'pipes' }[scene] ?? 'boards');
const shots = resolve(args.shots ?? join(here, '../../tests/out/shots'));
mkdirSync(shots, { recursive: true });

async function run(video, fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`,
      '--enable-unsafe-webgpu'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([p, e]) => {
    const s = JSON.parse(localStorage.getItem('oc.settings') || '{}');
    localStorage.setItem('oc.settings', JSON.stringify({ ...s, preset: p }));
    if (e === 'cv') localStorage.setItem('oc.engine.' + p, JSON.stringify({ engine: 'cv' }));
    else if (e !== 'auto') localStorage.setItem('oc.engine.' + p, JSON.stringify({ engine: 'yolo', modelId: e, classNames: [] }));
    else localStorage.removeItem('oc.engine.' + p);
  }, [preset, engine]);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  try {
    await page.goto(`${url}/?autostart=1`);
    await page.waitForFunction(() => window.__oc?.ready && document.getElementById('start-panel').hidden, null, { timeout: 120000 });
    return await fn(page);
  } finally {
    const errs = logs.filter((l) => /error/i.test(l));
    if (errs.length) console.log(errs.slice(0, 10).join('\n'));
    await browser.close();
  }
}

const results = {};

// ---- live: panning video, unique count must match distinct objects
{
  const meta = JSON.parse(readFileSync(join(vids, `${scene}_video.json`), 'utf8'));
  const r = await run(join(vids, `${scene}.y4m`), async (page) => {
    await page.click('#btn-reset');
    const fpsVideo = 15, loopMs = (meta.frames / fpsVideo) * 1000;
    const samples = [];
    const t0 = Date.now();
    while (Date.now() - t0 < loopMs * 1.05) {
      samples.push(await page.evaluate(() => ({ live: window.__oc.live, unique: window.__oc.unique, fps: window.__oc.fps })));
      await page.waitForTimeout(250);
    }
    await page.screenshot({ path: join(shots, `${scene}-${engine}-live.png`) });
    const info = await page.evaluate(() => ({ engine: window.__oc.engine, backend: window.__oc.backend }));
    return { samples, info };
  });
  const s = r.samples;
  const unique = s[s.length - 1].unique;
  const fps = s.reduce((a, b) => a + b.fps, 0) / s.length;
  const maxLive = Math.max(...s.map((x) => x.live));
  const gtPerFrameMax = Math.max(...meta.visible_per_frame);
  results.live = {
    engine: r.info.engine, backend: r.info.backend, fps: +fps.toFixed(1),
    gtDistinct: meta.distinct_visible, unique, uniqueErr: +((unique - meta.distinct_visible) / meta.distinct_visible).toFixed(3),
    gtMaxVisible: gtPerFrameMax, maxLive, framesAnalysedTotalVsUnique: `${s.reduce((a, b) => a + b.live, 0)} detections summed vs ${unique} unique`,
  };
}

// ---- freeze: static video, POLICZ
{
  const meta = JSON.parse(readFileSync(join(vids, `${scene}_static_video.json`), 'utf8'));
  const r = await run(join(vids, `${scene}_static.y4m`), async (page) => {
    await page.waitForTimeout(1500);
    const live = await page.evaluate(() => window.__oc.live);
    const t0 = Date.now();
    await page.click('#btn-count');
    await page.waitForFunction(() => window.__oc.frozen !== null && document.getElementById('busy').hidden, null, { timeout: 120000 });
    const ms = Date.now() - t0;
    const frozen = await page.evaluate(() => window.__oc.frozen);
    await page.screenshot({ path: join(shots, `${scene}-${engine}-freeze.png`) });
    // accept -> history
    await page.click('#btn-accept');
    await page.waitForTimeout(500);
    await page.click('#btn-history');
    await page.waitForTimeout(500);
    const hist = await page.evaluate(() => [...document.querySelectorAll('#history-list li .h-count')].map((e) => e.textContent));
    await page.screenshot({ path: join(shots, `${scene}-${engine}-history.png`) });
    return { live, frozen, ms, hist };
  });
  results.freeze = { gtVisible: meta.visible_per_frame[0], frozen: r.frozen, liveBefore: r.live, scanMs: r.ms, historyTop: r.hist[0] };
}

console.log(JSON.stringify({ scene, engine, preset, ...results }, null, 1));
