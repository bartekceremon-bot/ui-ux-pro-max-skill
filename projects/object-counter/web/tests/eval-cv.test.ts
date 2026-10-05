// Evaluates the model-free Separator on the synthetic scenes from tests/synth.py.
// Skipped unless `python tests/synth.py images` (+ raw dump) has been run.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { separate } from '../src/engine/separator';
import { iou } from '../src/engine/decode';

const dir = new URL('../../tests/out/raw/', import.meta.url).pathname;
const has = existsSync(dir + 'meta.json');

describe.skipIf(!has)('separator on synthetic scenes', () => {
  it('counts items', () => {
    const meta = JSON.parse(readFileSync(dir + 'meta.json', 'utf8'));
    const rows: string[] = [];
    let tpAll = 0, gtAll = 0, detAll = 0;
    for (const [f, m] of Object.entries<any>(meta)) {
      const buf = new Uint8ClampedArray(readFileSync(dir + f + '.raw'));
      const t0 = performance.now();
      const dets = separate(buf, m.w, m.h, { sensitivity: 0.5, polarity: 'auto' }, false);
      const ms = performance.now() - t0;
      const tp = m.boxes.filter((b: number[]) => dets.some((d) => iou(d, { x1: b[0], y1: b[1], x2: b[2], y2: b[3], score: 1, cls: 0 }) > 0.5)).length;
      tpAll += tp; gtAll += m.count; detAll += dets.length;
      rows.push(`${f.padEnd(20)} gt=${String(m.count).padStart(3)} det=${String(dets.length).padStart(3)} tp=${String(tp).padStart(3)} ${ms.toFixed(0)}ms`);
    }
    console.log(rows.join('\n') + `\nrecall=${(tpAll / gtAll).toFixed(2)} precision=${(tpAll / detAll).toFixed(2)}`);
    expect(tpAll / gtAll).toBeGreaterThan(0.3);
  }, 120_000);
});
