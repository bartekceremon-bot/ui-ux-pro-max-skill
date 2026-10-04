import { describe, expect, it } from 'vitest';
import { Tracker } from '../src/tracking/tracker';
import { hungarian } from '../src/tracking/hungarian';
import type { Detection } from '../src/engine/types';

/** deterministic PRNG */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

/** A static "stack" of objects in world coords, seen through a moving 640x480 window. */
function scene(rows: number, cols: number, w = 70, h = 30, gap = 6) {
  const objs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = 40 + c * (w + gap), y = 60 + r * (h + gap);
    objs.push({ x1: x, y1: y, x2: x + w, y2: y + h });
  }
  return objs;
}

function observe(objs: ReturnType<typeof scene>, camX: number, camY: number, R: () => number,
                 opts: { drop?: number; jitter?: number; fp?: number } = {}) {
  const W = 640, H = 480, dets: Detection[] = [], visible = new Set<number>();
  objs.forEach((o, k) => {
    const b = { x1: o.x1 - camX, y1: o.y1 - camY, x2: o.x2 - camX, y2: o.y2 - camY };
    const iw = Math.max(0, Math.min(b.x2, W) - Math.max(b.x1, 0)), ih = Math.max(0, Math.min(b.y2, H) - Math.max(b.y1, 0));
    if (iw * ih < 0.6 * (b.x2 - b.x1) * (b.y2 - b.y1)) return;
    visible.add(k);
    if (R() < (opts.drop ?? 0)) return; // missed detection
    const j = opts.jitter ?? 1.5;
    dets.push({ x1: b.x1 + (R() - 0.5) * j * 2, y1: b.y1 + (R() - 0.5) * j * 2, x2: b.x2 + (R() - 0.5) * j * 2,
      y2: b.y2 + (R() - 0.5) * j * 2, score: 0.5 + 0.45 * R(), cls: 0 });
  });
  if (R() < (opts.fp ?? 0)) { const x = R() * 560, y = R() * 400; dets.push({ x1: x, y1: y, x2: x + 60, y2: y + 30, score: 0.5, cls: 0 }); }
  return { dets, visible };
}

describe('hungarian', () => {
  it('finds the optimal assignment', () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
    expect(hungarian([[1, 2]])).toEqual([0]);
    expect(hungarian([[5], [1]])).toEqual([-1, 0]);
  });
});

describe('tracker', () => {
  it('static camera: N objects over many frames are counted N times, not N x frames', () => {
    const objs = scene(3, 6), R = rng(1), t = new Tracker();
    for (let f = 0; f < 60; f++) t.update(observe(objs, 0, 0, R, { drop: 0.1 }).dets, 640, 480, { dx: 0, dy: 0 });
    expect(t.uniqueCount).toBe(18);
    expect(new Set(t.view(640, 480).map((v) => v.id)).size).toBeGreaterThanOrEqual(16);
  });

  it('panning right and back with motion estimate: every object counted once, IDs survive re-entry', () => {
    const objs = scene(5, 20), R = rng(2), t = new Tracker();
    const seen = new Set<number>();
    let prevX = 0;
    const idOf = new Map<number, number>(); // object -> first id
    let idChanges = 0;
    for (let f = 0; f <= 120; f++) {
      const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * f) / 120);
      const camX = u * 1000, camY = 10 * Math.sin(f / 7);
      // noisy motion estimate (what GMC would give)
      const motion = { dx: -(camX - prevX) + (R() - 0.5) * 4, dy: (R() - 0.5) * 4 };
      prevX = camX;
      const { dets, visible } = observe(objs, camX, camY, R, { drop: 0.1, fp: 0.1 });
      visible.forEach((k) => seen.add(k));
      const views = t.update(dets, 640, 480, f === 0 ? null : motion);
      // map views back to objects by IoU to check ID stability
      for (const v of views) {
        let best = -1, bo = 0;
        objs.forEach((o, k) => {
          const b = { x1: o.x1 - camX, y1: o.y1 - camY, x2: o.x2 - camX, y2: o.y2 - camY };
          const iw = Math.min(b.x2, v.x2) - Math.max(b.x1, v.x1), ih = Math.min(b.y2, v.y2) - Math.max(b.y1, v.y1);
          const o2 = iw > 0 && ih > 0 ? (iw * ih) / ((b.x2 - b.x1) * (b.y2 - b.y1)) : 0;
          if (o2 > bo) { bo = o2; best = k; }
        });
        if (best < 0 || bo < 0.5) continue;
        if (!idOf.has(best)) idOf.set(best, v.id); else if (idOf.get(best) !== v.id) { idChanges++; idOf.set(best, v.id); }
      }
    }
    const err = Math.abs(t.uniqueCount - seen.size);
    expect(err).toBeLessThanOrEqual(Math.ceil(seen.size * 0.03));
    expect(idChanges).toBeLessThanOrEqual(3);
  });

  it('slow pan without any motion estimate still keeps IDs (IoU association)', () => {
    const objs = scene(4, 12), R = rng(3), t = new Tracker();
    const seen = new Set<number>();
    for (let f = 0; f < 100; f++) {
      const { dets, visible } = observe(objs, f * 3, 0, R, { drop: 0.05 });
      visible.forEach((k) => seen.add(k));
      t.update(dets, 640, 480, null);
    }
    expect(Math.abs(t.uniqueCount - seen.size)).toBeLessThanOrEqual(2);
  });

  it('single-frame false positives never get a number', () => {
    const R = rng(4), t = new Tracker();
    for (let f = 0; f < 50; f++) {
      const x = R() * 500, y = R() * 400;
      t.update([{ x1: x, y1: y, x2: x + 50, y2: y + 50, score: 0.9, cls: 0 }], 640, 480, { dx: 0, dy: 0 });
    }
    expect(t.uniqueCount).toBe(0);
  });
});
