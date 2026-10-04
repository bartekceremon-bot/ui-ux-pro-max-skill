/**
 * Global motion compensation: how far did the *camera* move between two
 * analysed frames?
 *
 * Coarse-to-fine SAD block matching of downscaled grayscale frames gives a
 * global translation. A small penalty for deviating from the previous motion
 * resolves the periodic ambiguity of repetitive scenes (a grid of identical
 * board ends looks almost the same shifted by exactly one board).
 *
 * The tracker shifts every track by this estimate before matching, so a fast
 * pan does not break IoU association, and objects that left the view keep a
 * consistent position in "world" (panorama) coordinates.
 */
export interface GrayFrame { w: number; h: number; data: Float32Array; scale: number }

/** Downscale RGBA to a small gray frame; `scale` = source px per gray px */
export function grayFrom(rgba: Uint8ClampedArray, w: number, h: number, target = 160): GrayFrame {
  const k = Math.max(1, Math.round(Math.max(w, h) / target));
  const gw = Math.floor(w / k), gh = Math.floor(h / k);
  const data = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let s = 0;
      for (let dy = 0; dy < k; dy++) {
        let j = ((y * k + dy) * w + x * k) * 4;
        for (let dx = 0; dx < k; dx++, j += 4) s += 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
      }
      data[y * gw + x] = s / (k * k);
    }
  }
  // zero-mean so global brightness changes (auto exposure, clouds) don't matter
  let m = 0;
  for (let i = 0; i < data.length; i++) m += data[i];
  m /= data.length;
  for (let i = 0; i < data.length; i++) data[i] -= m;
  return { w: gw, h: gh, data, scale: k };
}

function half(f: GrayFrame): GrayFrame {
  const w = f.w >> 1, h = f.h >> 1;
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 2 * y * f.w + 2 * x;
      d[y * w + x] = (f.data[i] + f.data[i + 1] + f.data[i + f.w] + f.data[i + f.w + 1]) / 4;
    }
  }
  return { w, h, data: d, scale: f.scale * 2 };
}

/** mean absolute difference of prev(x) vs cur(x + d) over the overlap */
function sad(a: GrayFrame, b: GrayFrame, dx: number, dy: number, step: number): number {
  const x0 = Math.max(0, -dx), x1 = Math.min(a.w, b.w - dx);
  const y0 = Math.max(0, -dy), y1 = Math.min(a.h, b.h - dy);
  if (x1 - x0 < a.w * 0.4 || y1 - y0 < a.h * 0.4) return Infinity;
  let s = 0, n = 0;
  for (let y = y0; y < y1; y += step) {
    const ra = y * a.w, rb = (y + dy) * b.w + dx;
    for (let x = x0; x < x1; x += step) { s += Math.abs(a.data[ra + x] - b.data[rb + x]); n++; }
  }
  return s / n;
}

function search(a: GrayFrame, b: GrayFrame, cx: number, cy: number, r: number, prior: { x: number; y: number } | null,
                lambda: number, step: number) {
  let best = { x: cx, y: cy }, bestV = Infinity, worst = 0;
  for (let dy = cy - r; dy <= cy + r; dy++) {
    for (let dx = cx - r; dx <= cx + r; dx++) {
      let v = sad(a, b, dx, dy, step);
      if (!isFinite(v)) continue;
      if (v > worst) worst = v;
      if (prior) v += lambda * Math.hypot(dx - prior.x, dy - prior.y);
      if (v < bestV) { bestV = v; best = { x: dx, y: dy }; }
    }
  }
  return { ...best, v: bestV, worst };
}

export interface Motion {
  /** translation in source px: content at p in prev is at p + (dx, dy) in cur */
  dx: number;
  dy: number;
  /** 0..1 -- how distinct the best match was (low = textureless / ambiguous) */
  confidence: number;
}

/**
 * Estimate global translation prev -> cur. `prior` is the previous motion in
 * source px (camera motion is smooth), used to break ties in periodic scenes.
 */
export function estimateMotion(prev: GrayFrame, cur: GrayFrame, prior: Motion | null = null): Motion {
  // exhaustive search on the 80 px level (sparse sampling), refine at 160 px.
  // (A coarser 40 px level aliases on fine repetitive texture like board ends.)
  const p1 = half(prev), c1 = half(cur);
  const R = Math.max(4, Math.round(p1.w * 0.3)); // up to ~30% of the frame per step
  const pr = prior ? { x: prior.dx / p1.scale, y: prior.dy / p1.scale } : null;
  const s1 = search(p1, c1, 0, 0, R, pr, 0.3, 2);
  const s0 = search(prev, cur, s1.x * 2, s1.y * 2, 2, null, 0, 1);
  const conf = s1.worst > 0 ? Math.max(0, Math.min(1, 1 - s1.v / s1.worst)) : 0;
  return { dx: s0.x * prev.scale, dy: s0.y * prev.scale, confidence: conf };
}
