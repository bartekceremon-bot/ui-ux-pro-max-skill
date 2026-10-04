/**
 * "Separator" -- a model-free, class-agnostic instance splitter for stacks of
 * similar items seen end-on: board ends in a lumber pile, pipe/tube ends,
 * logs, boxes with visible seams.
 *
 * Pipeline (all on a downscaled grayscale frame, a few ms at 480 px):
 *   1. adaptive threshold (local mean)  -> items vs. the darker gaps between them
 *   2. hole filling                     -> hollow pipe ends become solid discs
 *   3. morphological opening            -> cut thin bridges between touching items
 *   4. chamfer distance transform       -> "how deep inside an item" each pixel is
 *   5. watershed with dynamics merging  -> one basin per item; basins whose peaks
 *      are not separated by a deep enough saddle are merged (stops long planks
 *      from being chopped into pieces, while touching ends are split)
 *   6. size-consistency filter          -> keep regions near the dominant item size
 *
 * It needs visible gaps/edges between items and does not know *what* an item
 * is, which is exactly why it complements the neural models: it works on day
 * one for any uniform stack, before a dedicated model is trained.
 */
import type { CvOptions, Detection } from './types';

interface Gray { w: number; h: number; g: Float32Array; chroma: Float32Array }

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Gray {
  const g = new Float32Array(w * h), chroma = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) {
    const r = rgba[j], gg = rgba[j + 1], b = rgba[j + 2];
    g[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
    chroma[i] = Math.max(r, gg, b) - Math.min(r, gg, b);
  }
  return { w, h, g, chroma };
}

function integral(g: Float32Array, w: number, h: number): Float64Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  return I;
}

function boxBlur3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += src[yy * w + xx]; n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

/** foreground mask + per-pixel signed margin over the local mean (positive = more "item-like") */
function threshold(gray: Gray, win: number, offset: number, bright: boolean): { fg: Uint8Array; margin: Float32Array } {
  const { w, h } = gray;
  const g = boxBlur3(gray.g, w, h);
  const I = integral(g, w, h);
  const r = Math.max(2, win >> 1);
  const fg = new Uint8Array(w * h);
  const margin = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      const mean = s / ((x1 - x0) * (y1 - y0));
      const m = bright ? g[y * w + x] - mean : mean - g[y * w + x];
      margin[y * w + x] = m;
      fg[y * w + x] = m > offset ? 1 : 0;
    }
  }
  return { fg, margin };
}

function morph(src: Uint8Array, w: number, h: number, erode: boolean): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let dy = -1; dy <= 1 && v === (erode ? 1 : 0); dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const s = src[yy * w + xx];
          if (erode && !s) { v = 0; break; }
          if (!erode && s) { v = 1; break; }
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** 4-connected component labelling; returns labels (0 = none) and areas */
function components(mask: Uint8Array, w: number, h: number, value: number) {
  const lab = new Int32Array(w * h);
  const areas: number[] = [0];
  const touchesBorder: boolean[] = [false];
  const stack: number[] = [];
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== value || lab[i]) continue;
    n++;
    let area = 0, border = false;
    lab[i] = n; stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      if (x > 0 && mask[p - 1] === value && !lab[p - 1]) { lab[p - 1] = n; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] === value && !lab[p + 1]) { lab[p + 1] = n; stack.push(p + 1); }
      if (y > 0 && mask[p - w] === value && !lab[p - w]) { lab[p - w] = n; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] === value && !lab[p + w]) { lab[p + w] = n; stack.push(p + w); }
    }
    areas.push(area); touchesBorder.push(border);
  }
  return { lab, areas, touchesBorder, n };
}

function fillHoles(fg: Uint8Array, w: number, h: number): void {
  const fgc = components(fg, w, h, 1);
  const sizes = fgc.areas.slice(1).filter((a) => a > 8).sort((a, b) => a - b);
  const med = sizes.length ? sizes[sizes.length >> 1] : 0;
  const bg = components(fg, w, h, 0);
  const maxHole = Math.max(16, med * 3);
  for (let i = 0; i < fg.length; i++) {
    const l = bg.lab[i];
    if (l && !bg.touchesBorder[l] && bg.areas[l] <= maxHole) fg[i] = 1;
  }
}

/** chamfer 3-4 distance to the nearest background pixel, in pixels */
function distance(fg: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = fg[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3); else v = Math.min(v, 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      } else v = Math.min(v, 3);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3); else v = Math.min(v, 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      } else v = Math.min(v, 3);
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/** Watershed on -distance with merging of basins whose dynamic is below `hDyn`. */
function watershed(dist: Float32Array, w: number, h: number, hDyn: number): Int32Array {
  const n = w * h;
  // bucket sort pixels by distance, descending (quarter-pixel resolution)
  let maxD = 0;
  for (let i = 0; i < n; i++) if (dist[i] > maxD) maxD = dist[i];
  const B = Math.ceil(maxD * 4) + 1;
  const counts = new Int32Array(B + 1);
  for (let i = 0; i < n; i++) if (dist[i] > 0) counts[B - Math.round(dist[i] * 4)]++;
  for (let b = 1; b <= B; b++) counts[b] += counts[b - 1];
  const order = new Int32Array(counts[B]);
  const pos = new Int32Array(B + 1);
  for (let b = 1; b <= B; b++) pos[b] = counts[b - 1];
  for (let i = 0; i < n; i++) if (dist[i] > 0) order[pos[B - Math.round(dist[i] * 4)]++] = i;

  const label = new Int32Array(n); // basin id (union-find element), 0 = unvisited
  const parent: number[] = [0];
  const peak: number[] = [0];
  const find = (a: number): number => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const roots: number[] = [];
  for (let k = 0; k < order.length; k++) {
    const p = order[k];
    const x = p % w, y = (p / w) | 0;
    const level = dist[p];
    roots.length = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((!dx && !dy) || xx < 0 || xx >= w) continue;
        const l = label[yy * w + xx];
        if (!l) continue;
        const r = find(l);
        if (!roots.includes(r)) roots.push(r);
      }
    }
    if (!roots.length) {
      const id = parent.length;
      parent.push(id); peak.push(level);
      label[p] = id;
      continue;
    }
    roots.sort((a, b) => peak[b] - peak[a]);
    const main = roots[0];
    for (let i = 1; i < roots.length; i++) {
      const r = roots[i];
      if (peak[r] - level < hDyn) parent[r] = main; // shallow saddle -> same item
    }
    label[p] = main;
  }
  for (let i = 0; i < n; i++) if (label[i]) label[i] = find(label[i]);
  return label;
}

interface Region {
  x1: number; y1: number; x2: number; y2: number; area: number; peak: number; id: number;
  contrast: number; gray: number; chroma: number;
}

function regions(label: Int32Array, dist: Float32Array, margin: Float32Array, gray: Gray): Region[] {
  const { w, h } = gray;
  const map = new Map<number, Region>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, l = label[i];
      if (!l) continue;
      let r = map.get(l);
      if (!r) { r = { x1: x, y1: y, x2: x, y2: y, area: 0, peak: 0, id: l, contrast: 0, gray: 0, chroma: 0 }; map.set(l, r); }
      r.area++;
      r.contrast += margin[i];
      r.gray += gray.g[i];
      r.chroma += gray.chroma[i];
      if (x < r.x1) r.x1 = x; if (x > r.x2) r.x2 = x;
      if (y < r.y1) r.y1 = y; if (y > r.y2) r.y2 = y;
      if (dist[i] > r.peak) r.peak = dist[i];
    }
  }
  for (const r of map.values()) { r.contrast /= r.area; r.gray /= r.area; r.chroma /= r.area; }
  return [...map.values()];
}

/** Area-weighted mode of log2(area): the size most of the *pixels* belong to. */
function dominantArea(rs: Region[]): number {
  const bins = new Float64Array(64);
  for (const r of rs) {
    const b = Math.min(63, Math.max(0, Math.round(Math.log2(r.area) * 3)));
    bins[b] += r.area;
  }
  let best = 0, bestV = -1;
  for (let b = 0; b < 64; b++) {
    const v = (bins[b - 1] ?? 0) * 0.5 + bins[b] + (bins[b + 1] ?? 0) * 0.5;
    if (v > bestV) { bestV = v; best = b; }
  }
  return Math.pow(2, best / 3);
}

/**
 * Undo over-splitting: two touching basins are one item when the line where
 * they meet is about as long as the item is thick (a long board whose
 * distance ridge had two bumps). Genuinely touching items meet at a narrow
 * neck instead (discs, rounded ends) -- or are separated by a gap anyway.
 */
function mergeOversplit(labels: Int32Array, rs: Region[], w: number, h: number, dom: number): boolean {
  const byId = new Map(rs.map((r) => [r.id, r]));
  const contact = new Map<number, number>();
  const K = 1e7;
  const add = (a: number, b: number) => {
    if (!a || !b || a === b || !byId.has(a) || !byId.has(b)) return;
    const k = a < b ? a * K + b : b * K + a;
    contact.set(k, (contact.get(k) ?? 0) + 1);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x < w - 1) add(labels[i], labels[i + 1]);
      if (y < h - 1) add(labels[i], labels[i + w]);
    }
  }
  const parent = new Map<number, number>();
  const find = (a: number): number => { while (parent.has(a)) a = parent.get(a)!; return a; };
  const area = new Map(rs.map((r) => [r.id, r.area]));
  let merged = false;
  // strongest contacts first
  for (const [k, len] of [...contact.entries()].sort((p, q) => q[1] - p[1])) {
    const a = find(Math.floor(k / K)), b = find(k % K);
    if (a === b) continue;
    const ra = byId.get(Math.floor(k / K))!, rb = byId.get(k % K)!;
    const thick = 2 * Math.min(ra.peak, rb.peak);
    const sum = area.get(a)! + area.get(b)!;
    if (len >= 0.75 * thick && sum <= 1.7 * dom) {
      parent.set(b, a);
      area.set(a, sum);
      merged = true;
    }
  }
  if (!merged) return false;
  for (let i = 0; i < labels.length; i++) if (labels[i] && parent.has(labels[i])) labels[i] = find(labels[i]);
  return true;
}

/** robust z-score helper: median and MAD-based scale */
function robust(values: number[], floor: number) {
  const v = values.slice().sort((a, b) => a - b);
  const med = v[v.length >> 1];
  const dev = v.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  const mad = Math.max(floor, 1.4826 * dev[dev.length >> 1]);
  return (x: number) => Math.abs(x - med) / mad;
}

export interface SeparatorResult { dets: Detection[]; quality: number; labels: Int32Array }

function runPolarity(gray: Gray, opt: CvOptions, bright: boolean): SeparatorResult {
  const { w, h } = gray;
  const sens = Math.min(1, Math.max(0, opt.sensitivity));
  const win = Math.max(15, Math.round(Math.min(w, h) / 6));
  const offset = (0.5 - sens) * 16;
  const th = threshold(gray, win, offset, bright);
  let fg = th.fg;
  fillHoles(fg, w, h);
  fg = morph(morph(fg, w, h, true), w, h, false);
  const dist = distance(fg, w, h);
  // typical item "radius" from local maxima of the distance map
  const peaks: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, v = dist[i];
      if (v < 2) continue;
      if (v >= dist[i - 1] && v >= dist[i + 1] && v >= dist[i - w] && v >= dist[i + w]) peaks.push(v);
    }
  }
  peaks.sort((a, b) => a - b);
  const peakMed = peaks.length ? peaks[peaks.length >> 1] : 2;
  const hDyn = Math.max(1, (0.55 - 0.4 * sens) * peakMed);
  const labels = watershed(dist, w, h, hDyn);
  let rs = regions(labels, dist, th.margin, gray).filter((r) => r.area >= 12);
  if (!rs.length) return { dets: [], quality: 0, labels };
  // Items stand out from the gaps far more than texture blobs on the ground do:
  // keep regions whose contrast is comparable to the strongest ones in view.
  const cs = rs.map((r) => r.contrast).sort((a, b) => a - b);
  const cRef = cs[Math.floor(cs.length * 0.9)];
  const cMin = Math.max(4, (0.6 - 0.3 * sens) * cRef);
  rs = rs.filter((r) => r.contrast >= cMin);
  if (!rs.length) return { dets: [], quality: 0, labels };
  let dom = dominantArea(rs);
  if (mergeOversplit(labels, rs, w, h, dom)) {
    const keep = new Set(rs.map((r) => r.id));
    rs = regions(labels, dist, th.margin, gray).filter((r) => r.area >= 12 && keep.has(r.id));
    dom = dominantArea(rs);
  }
  // shape/size gate
  const cand = rs.map((r) => {
    const bw = r.x2 - r.x1 + 1, bh = r.y2 - r.y1 + 1;
    return { r, ratio: r.area / dom, fill: r.area / (bw * bh), aspect: Math.log(bw / bh) };
  }).filter((c) => c.ratio >= 0.3 && c.ratio <= 3.5 && c.fill >= 0.45);
  if (!cand.length) return { dets: [], quality: 0, labels };
  // Items of one stack look alike: same brightness, colour saturation, proportions.
  // Reject regions that are outliers w.r.t. the typical-size ones (ground blobs, shadow strips).
  const core = cand.filter((c) => c.ratio >= 0.6 && c.ratio <= 1.6);
  const ref = core.length >= 3 ? core : cand;
  const zg = robust(ref.map((c) => c.r.gray), 8);
  const zc = robust(ref.map((c) => c.r.chroma), 6);
  const za = robust(ref.map((c) => c.aspect), 0.25);
  const dets: Detection[] = [];
  let scoreSum = 0;
  for (const c of cand) {
    const z = Math.max(zg(c.r.gray), zc(c.r.chroma), za(c.aspect));
    if (z > 4) continue;
    const sizeScore = 1 - Math.min(1, Math.abs(Math.log(c.ratio)) / Math.log(3.5));
    const fillScore = Math.min(1, (c.fill - 0.45) / 0.4);
    const likeScore = 1 - Math.min(1, z / 4);
    const score = Math.min(0.99, 0.25 + 0.25 * sizeScore + 0.25 * fillScore + 0.25 * likeScore);
    const r = c.r;
    dets.push({ x1: r.x1, y1: r.y1, x2: r.x2 + 1, y2: r.y2 + 1, score, cls: 0, mask: undefined });
    (dets[dets.length - 1] as Detection & { _id?: number })._id = r.id;
    scoreSum += score;
  }
  // a regular result has many items of consistent size and high confidence
  const quality = dets.length >= 2 ? scoreSum * Math.min(1, dets.length / 4) : 0;
  return { dets, quality, labels };
}

/**
 * Detect items in an RGBA image. Coordinates are in the given image's pixels.
 * Masks are attached when `withMasks` (one cell per pixel).
 */
export function separate(rgba: Uint8ClampedArray, w: number, h: number, opt: CvOptions, withMasks: boolean): Detection[] {
  const gray = toGray(rgba, w, h);
  let res: SeparatorResult;
  if (opt.polarity === 'bright') res = runPolarity(gray, opt, true);
  else if (opt.polarity === 'dark') res = runPolarity(gray, opt, false);
  else {
    const a = runPolarity(gray, opt, true), b = runPolarity(gray, opt, false);
    res = a.quality >= b.quality ? a : b;
  }
  for (const d of res.dets) {
    const id = (d as Detection & { _id?: number })._id!;
    delete (d as Detection & { _id?: number })._id;
    if (!withMasks) continue;
    const mw = d.x2 - d.x1, mh = d.y2 - d.y1;
    const data = new Uint8Array(mw * mh);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) data[y * mw + x] = res.labels[(d.y1 + y) * w + d.x1 + x] === id ? 1 : 0;
    }
    d.mask = { x: d.x1, y: d.y1, w: mw, h: mh, scale: 1, data };
  }
  return res.dets;
}
