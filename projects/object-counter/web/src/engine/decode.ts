/**
 * YOLO (v8 / 11 / 26 raw head, YOLOE) output decoding: boxes, NMS, instance masks.
 *
 * Pure functions on typed arrays so they can be unit-tested in Node and run
 * inside the inference worker.
 *
 * output0: [1, 4 + nc + nm, N]  (cx, cy, w, h, class scores..., mask coeffs...)
 * output1: [1, nm, ph, pw]      mask prototypes (segmentation models only)
 */
import type { Detection, InstanceMask } from './types';

/** Maps model-input pixels back to source-image pixels. */
export interface Letterbox {
  /** model input px per source px */
  r: number;
  padX: number;
  padY: number;
  /** offset of the analysed region (tile) inside the source image */
  offX: number;
  offY: number;
  imgsz: number;
}

export interface Candidate extends Detection {
  /** anchor index into output0 (for mask coefficients) */
  idx: number;
}

export interface DecodeOptions {
  conf: number;
  iou: number;
  classes: number[] | null;
  agnostic: boolean;
  maxDet?: number;
}

export interface Protos {
  data: Float32Array;
  nm: number;
  ph: number;
  pw: number;
}

export function decodeBoxes(out: Float32Array, N: number, nc: number,
                            opt: DecodeOptions, lb: Letterbox): Candidate[] {
  const cands: Candidate[] = [];
  const allowed = opt.classes && opt.classes.length ? opt.classes : null;
  for (let n = 0; n < N; n++) {
    let best = -1, bestS = opt.conf;
    if (allowed) {
      for (const c of allowed) {
        const s = out[(4 + c) * N + n];
        if (s > bestS) { bestS = s; best = c; }
      }
    } else {
      for (let c = 0; c < nc; c++) {
        const s = out[(4 + c) * N + n];
        if (s > bestS) { bestS = s; best = c; }
      }
    }
    if (best < 0) continue;
    const cx = out[n], cy = out[N + n], w = out[2 * N + n], h = out[3 * N + n];
    const x1 = (cx - w / 2 - lb.padX) / lb.r + lb.offX;
    const y1 = (cy - h / 2 - lb.padY) / lb.r + lb.offY;
    const x2 = (cx + w / 2 - lb.padX) / lb.r + lb.offX;
    const y2 = (cy + h / 2 - lb.padY) / lb.r + lb.offY;
    cands.push({ x1, y1, x2, y2, score: bestS, cls: best, idx: n });
  }
  return cands;
}

export function iou(a: Detection, b: Detection): number {
  const iw = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const ih = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

/** intersection over the smaller box -- catches a truncated box inside a full one */
export function ioMin(a: Detection, b: Detection): number {
  const iw = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const ih = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (iw <= 0 || ih <= 0) return 0;
  return (iw * ih) / Math.min((a.x2 - a.x1) * (a.y2 - a.y1), (b.x2 - b.x1) * (b.y2 - b.y1));
}

/**
 * Greedy NMS. When `maskIoU` is given, two strongly overlapping *boxes* are
 * both kept if their *masks* barely overlap -- that is what separates
 * adjacent, tilted or partially occluded objects (e.g. leaning boards) whose
 * bounding boxes overlap a lot even though they are different instances.
 */
export function nms<T extends Detection>(dets: T[], iouThr: number, agnostic: boolean,
                                         maskIoU?: (a: T, b: T) => number, maxDet = 1000): T[] {
  const order = dets.slice().sort((a, b) => b.score - a.score);
  const keep: T[] = [];
  const removed = new Uint8Array(order.length);
  for (let i = 0; i < order.length && keep.length < maxDet; i++) {
    if (removed[i]) continue;
    const a = order[i];
    keep.push(a);
    for (let j = i + 1; j < order.length; j++) {
      if (removed[j]) continue;
      const b = order[j];
      if (!agnostic && a.cls !== b.cls) continue;
      const o = iou(a, b);
      if (o <= iouThr) continue;
      if (maskIoU && o < 0.9 && maskIoU(a, b) < 0.45) continue;
      removed[j] = 1;
    }
  }
  return keep;
}

/**
 * Drop "group" boxes: one large detection that contains several other
 * detections (the whole stack detected as one object). Counting needs the
 * individual items, so a box enclosing >= 2 smaller kept boxes that are each
 * mostly inside it is removed.
 */
export function dropGroupBoxes<T extends Detection>(dets: T[]): T[] {
  if (dets.length < 3) return dets;
  const area = (d: Detection) => (d.x2 - d.x1) * (d.y2 - d.y1);
  const drop = new Set<number>();
  for (let i = 0; i < dets.length; i++) {
    const A = dets[i], aA = area(A);
    let inside = 0, insideArea = 0;
    for (let j = 0; j < dets.length; j++) {
      if (i === j) continue;
      const B = dets[j], aB = area(B);
      if (aB * 1.8 > aA) continue;
      const iw = Math.min(A.x2, B.x2) - Math.max(A.x1, B.x1);
      const ih = Math.min(A.y2, B.y2) - Math.max(A.y1, B.y1);
      if (iw > 0 && ih > 0 && (iw * ih) / aB > 0.8) { inside++; insideArea += aB; }
    }
    // must actually be *filled* by the parts, not just overlap one or two
    if (inside >= 2 && insideArea > 0.35 * aA) drop.add(i);
  }
  return drop.size ? dets.filter((_, i) => !drop.has(i)) : dets;
}

/** Mask logits for one candidate over a proto-grid rectangle. */
function maskLogits(out: Float32Array, N: number, nc: number, p: Protos, idx: number,
                    gx0: number, gy0: number, gx1: number, gy1: number): Float32Array {
  const { data, nm, ph, pw } = p;
  const w = gx1 - gx0, h = gy1 - gy0;
  const res = new Float32Array(Math.max(0, w * h));
  const coef = new Float32Array(nm);
  for (let k = 0; k < nm; k++) coef[k] = out[(4 + nc + k) * N + idx];
  for (let k = 0; k < nm; k++) {
    const ck = coef[k];
    if (ck === 0) continue;
    const base = k * ph * pw;
    for (let y = 0; y < h; y++) {
      const row = base + (gy0 + y) * pw + gx0;
      const o = y * w;
      for (let x = 0; x < w; x++) res[o + x] += ck * data[row + x];
    }
  }
  return res;
}

/** proto-grid rectangle covering a source-space box */
function gridRect(d: Detection, lb: Letterbox, p: Protos) {
  const s = p.pw / lb.imgsz; // proto cells per model px
  const toGx = (x: number) => ((x - lb.offX) * lb.r + lb.padX) * s;
  const toGy = (y: number) => ((y - lb.offY) * lb.r + lb.padY) * s;
  const gx0 = Math.max(0, Math.floor(toGx(d.x1)));
  const gy0 = Math.max(0, Math.floor(toGy(d.y1)));
  const gx1 = Math.min(p.pw, Math.ceil(toGx(d.x2)));
  const gy1 = Math.min(p.ph, Math.ceil(toGy(d.y2)));
  return { gx0, gy0, gx1, gy1, s };
}

export function buildMask(out: Float32Array, N: number, nc: number, p: Protos, c: Candidate,
                          lb: Letterbox): InstanceMask | undefined {
  const { gx0, gy0, gx1, gy1, s } = gridRect(c, lb, p);
  if (gx1 <= gx0 || gy1 <= gy0) return undefined;
  const logits = maskLogits(out, N, nc, p, c.idx, gx0, gy0, gx1, gy1);
  const data = new Uint8Array(logits.length);
  let on = 0;
  for (let i = 0; i < logits.length; i++) if (logits[i] > 0) { data[i] = 1; on++; } // sigmoid > 0.5
  if (!on) return undefined;
  const cell = 1 / (s * lb.r); // source px per cell
  return {
    x: (gx0 / s - lb.padX) / lb.r + lb.offX,
    y: (gy0 / s - lb.padY) / lb.r + lb.offY,
    w: gx1 - gx0, h: gy1 - gy0, scale: cell, data,
  };
}

/** Mask IoU on the proto grid, restricted to the union of both boxes. */
export function makeMaskIoU(out: Float32Array, N: number, nc: number, p: Protos, lb: Letterbox) {
  return (a: Candidate, b: Candidate): number => {
    const u = { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) } as Detection;
    const { gx0, gy0, gx1, gy1 } = gridRect(u, lb, p);
    if (gx1 <= gx0 || gy1 <= gy0) return 1;
    const ra = gridRect(a, lb, p), rb = gridRect(b, lb, p);
    const ma = maskLogits(out, N, nc, p, a.idx, gx0, gy0, gx1, gy1);
    const mb = maskLogits(out, N, nc, p, b.idx, gx0, gy0, gx1, gy1);
    const w = gx1 - gx0;
    let inter = 0, uni = 0;
    for (let i = 0; i < ma.length; i++) {
      const x = gx0 + (i % w), y = gy0 + ((i / w) | 0);
      const inA = ma[i] > 0 && x >= ra.gx0 && x < ra.gx1 && y >= ra.gy0 && y < ra.gy1;
      const inB = mb[i] > 0 && x >= rb.gx0 && x < rb.gx1 && y >= rb.gy0 && y < rb.gy1;
      if (inA && inB) inter++;
      if (inA || inB) uni++;
    }
    return uni ? inter / uni : 0;
  };
}

/** Full post-processing for one inference pass. */
export function postprocess(out: Float32Array, dims: readonly number[], protos: Protos | null,
                            nc: number, opt: DecodeOptions, lb: Letterbox, wantMasks: boolean): Detection[] {
  const N = dims[2];
  const cands = decodeBoxes(out, N, nc, opt, lb);
  const mIoU = protos ? makeMaskIoU(out, N, nc, protos, lb) : undefined;
  // pre-NMS cap keeps worst-case cost bounded on very dense scenes
  const pre = cands.length > 3000 ? cands.sort((a, b) => b.score - a.score).slice(0, 3000) : cands;
  let kept = nms(pre, opt.iou, opt.agnostic, mIoU, opt.maxDet ?? 1000);
  kept = dropGroupBoxes(kept);
  return kept.map((c) => {
    const d: Detection = { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, score: c.score, cls: c.cls };
    if (wantMasks && protos) d.mask = buildMask(out, N, nc, protos, c, lb);
    return d;
  });
}

/**
 * Stack filter: items of a stack touch or nearly touch each other. Keep the
 * detections that belong to a contiguous group (neighbours closer than ~0.6x
 * the typical item size) and drop size outliers -- isolated false positives
 * on gravel, trucks, walls or sky disappear, the stack itself stays.
 */
export function stackFilter<T extends Detection>(dets: T[], minFrac = 0.1): T[] {
  if (dets.length < 3) return dets;
  const area = dets.map((d) => (d.x2 - d.x1) * (d.y2 - d.y1));
  const med = area.slice().sort((a, b) => a - b)[area.length >> 1];
  const ok = area.map((a) => a > 0.2 * med && a < 5 * med);
  const md = Math.sqrt(med) * 0.6;
  const par = dets.map((_, i) => i);
  const find = (x: number): number => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let i = 0; i < dets.length; i++) {
    if (!ok[i]) continue;
    const a = dets[i];
    for (let j = i + 1; j < dets.length; j++) {
      if (!ok[j]) continue;
      const b = dets[j];
      const gx = Math.max(0, b.x1 - a.x2, a.x1 - b.x2);
      const gy = Math.max(0, b.y1 - a.y2, a.y1 - b.y2);
      if (gx < md && gy < md) par[find(i)] = find(j);
    }
  }
  const size = new Map<number, number>();
  dets.forEach((_, i) => { if (ok[i]) { const r = find(i); size.set(r, (size.get(r) ?? 0) + 1); } });
  if (!size.size) return dets;
  const big = Math.max(...size.values());
  const keepRoot = new Set([...size].filter(([, n]) => n >= Math.max(3, minFrac * big)).map(([r]) => r));
  return dets.filter((_, i) => ok[i] && keepRoot.has(find(i)));
}
