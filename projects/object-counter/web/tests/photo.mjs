// Photo-mode smoke test: upload an image file, run the accurate scan in the
// browser with a given model, print the count and save a screenshot.
//   node web/tests/photo.mjs --url http://127.0.0.1:8000 --img tests/out/bus.jpg --model coco-yolo11n-seg --classes person
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const logs = [];
page.on('console', (m) => logs.push(m.text()));
await page.addInitScript(([model, classes, preset, engine]) => {
  localStorage.setItem('oc.settings', JSON.stringify({ preset }));
  if (engine === 'auto') localStorage.removeItem('oc.engine.' + preset);
  else localStorage.setItem('oc.engine.' + preset, JSON.stringify(engine === 'cv' ? { engine: 'cv' } : { engine: 'yolo', modelId: model, classNames: classes ? classes.split(',') : [] }));
}, [a.model ?? 'coco-yolo11n-seg', a.classes ?? '', a.preset ?? 'custom', a.engine ?? 'yolo']);
await page.goto(a.url ?? 'http://127.0.0.1:8000');
await page.waitForFunction(() => window.__oc?.ready, null, { timeout: 120000 });
const t0 = Date.now();
await page.setInputFiles('#file', resolve(a.img));
await page.waitForFunction(() => window.__oc.frozen !== null && document.getElementById('busy').hidden, null, { timeout: 120000 });
const n = await page.evaluate(() => window.__oc.frozen);
const info = await page.evaluate(() => ({ engine: window.__oc.engine, backend: window.__oc.backend }));
await page.screenshot({ path: a.out ?? resolve('../tests/out/shots/photo.png') });
console.log(JSON.stringify({ img: a.img, count: n, ms: Date.now() - t0, ...info, log: logs.filter((l) => /still|error/i.test(l)) }));
await browser.close();
