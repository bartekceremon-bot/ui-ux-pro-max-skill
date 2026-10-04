/**
 * Multi-object tracker for counting -- ByteTrack-style association plus a
 * camera-motion-aware "world" memory, so the same physical object keeps its
 * ID (and is counted once) while the camera moves.
 *
 *  - Every track lives in world coordinates = frame coordinates + accumulated
 *    camera offset (from global motion compensation, see gmc.ts).
 *  - Association, ByteTrack style: high-confidence detections first (Hungarian
 *    on IoU), then low-confidence detections may only *continue* existing
 *    tracks -- they never create new ones. Occluded / blurred objects survive
 *    a few weak frames without spawning duplicates.
 *  - After the first matching stage the median residual of matched tracks
 *    corrects the camera offset (closes GMC drift), unmatched tracks are
 *    re-tried with the corrected positions.
 *  - A track gets a visible number (#1, #2, ...) only after `minHits`
 *    consecutive detections, so one-frame false positives never consume IDs.
 *  - A track whose predicted position is *outside* the view is not aged: it
 *    is remembered, and when the camera pans back it is matched again under
 *    the same ID instead of being counted a second time.
 */
import type { Detection, InstanceMask } from '../engine/types';
import { iou } from '../engine/decode';
import { hungarian } from './hungarian';

class KF1 {
  p: number; v = 0; P00 = 10; P01 = 0; P11 = 10;
  constructor(p: number, private q: number, private qv: number, private r: number) { this.p = p; }
  predict() {
    this.p += this.v;
    // P = F P F' + Q with F = [[1,1],[0,1]]
    const P00 = this.P00 + 2 * this.P01 + this.P11 + this.q;
    const P01 = this.P01 + this.P11;
    const P11 = this.P11 + this.qv;
    this.P00 = P00; this.P01 = P01; this.P11 = P11;
  }
  update(z: number, rScale = 1) {
    const S = this.P00 + this.r * rScale;
    const K0 = this.P00 / S, K1 = this.P01 / S;
    const y = z - this.p;
    this.p += K0 * y; this.v += K1 * y;
    const P00 = (1 - K0) * this.P00, P01 = (1 - K0) * this.P01, P11 = this.P11 - K1 * this.P01;
    this.P00 = P00; this.P01 = P01; this.P11 = P11;
  }
  freeze() { this.v = 0; }
}

export interface TrackerConfig {
  /** detections >= high start/continue tracks; between low and high only continue */
  high: number;
  low: number;
  /** min IoU for association (after motion compensation) */
  matchIoU: number;
  minHits: number;
  /** frames a confirmed, in-view track may go undetected before it is dropped */
  maxMissInView: number;
  /** fraction of a box that must be inside the frame to count as "in view" */
  inViewFrac: number;
}

export const defaultTrackerConfig: TrackerConfig = {
  high: 0.45, low: 0.15, matchIoU: 0.2, minHits: 3, maxMissInView: 15, inViewFrac: 0.6,
};

export interface Track {
  key: number;
  /** visible number (#n), 0 while tentative */
  id: number;
  cx: KF1; cy: KF1; w: KF1; h: KF1;
  score: number;
  cls: number;
  hits: number;
  misses: number;
  confirmed: boolean;
  /** matched in the latest update */
  seen: boolean;
  mask?: InstanceMask;
  /** last detection box (frame coords) for drawing */
  last: Detection;
}

export interface TrackView {
  id: number;
  x1: number; y1: number; x2: number; y2: number;
  score: number;
  cls: number;
  mask?: InstanceMask;
  /** drawn from prediction (object briefly not detected) */
  predicted: boolean;
}

export class Tracker {
  cfg: TrackerConfig;
  tracks: Track[] = [];
  /** camera offset: world = frame + cam */
  camX = 0; camY = 0;
  private nextKey = 1;
  private nextId = 1;
  frame = 0;

  constructor(cfg: Partial<TrackerConfig> = {}) { this.cfg = { ...defaultTrackerConfig, ...cfg }; }

  reset() { this.tracks = []; this.camX = 0; this.camY = 0; this.nextId = 1; this.frame = 0; }

  /** number of distinct confirmed objects remembered in the scene */
  get uniqueCount() { return this.tracks.filter((t) => t.confirmed).length; }

  private frameBox(t: Track) {
    const cx = t.cx.p - this.camX, cy = t.cy.p - this.camY, w = Math.max(1, t.w.p), h = Math.max(1, t.h.p);
    return { x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, score: t.score, cls: t.cls };
  }

  private inView(b: Detection, W: number, H: number) {
    const iw = Math.max(0, Math.min(b.x2, W) - Math.max(b.x1, 0));
    const ih = Math.max(0, Math.min(b.y2, H) - Math.max(b.y1, 0));
    return iw * ih >= this.cfg.inViewFrac * (b.x2 - b.x1) * (b.y2 - b.y1);
  }

  private match(trs: Track[], dets: Detection[], minIoU: number) {
    if (!trs.length || !dets.length) return { pairs: [] as [Track, Detection][], ut: trs, ud: dets };
    const boxes = trs.map((t) => this.frameBox(t));
    const cost = boxes.map((b) => dets.map((d) => {
      const o = iou(b, d);
      return o >= minIoU ? 1 - o : 1e6;
    }));
    const assign = hungarian(cost);
    const pairs: [Track, Detection][] = [];
    const usedD = new Set<number>();
    const usedT = new Set<number>();
    assign.forEach((j, i) => {
      if (j >= 0 && cost[i][j] < 1e6) { pairs.push([trs[i], dets[j]]); usedD.add(j); usedT.add(i); }
    });
    return { pairs, ut: trs.filter((_, i) => !usedT.has(i)), ud: dets.filter((_, j) => !usedD.has(j)) };
  }

  private apply(t: Track, d: Detection) {
    const cx = (d.x1 + d.x2) / 2 + this.camX, cy = (d.y1 + d.y2) / 2 + this.camY;
    t.cx.update(cx); t.cy.update(cy);
    t.w.update(d.x2 - d.x1); t.h.update(d.y2 - d.y1);
    t.score = t.hits ? 0.7 * t.score + 0.3 * d.score : d.score;
    t.cls = d.cls;
    t.hits++; t.misses = 0; t.seen = true;
    t.mask = d.mask; t.last = d;
    if (!t.confirmed && t.hits >= this.cfg.minHits) { t.confirmed = true; t.id = this.nextId++; }
  }

  /**
   * @param dets   detections of the current frame (frame px)
   * @param motion camera-content motion since the previous update (frame px), or null
   */
  update(dets: Detection[], W: number, H: number, motion: { dx: number; dy: number } | null): TrackView[] {
    this.frame++;
    if (motion) { this.camX -= motion.dx; this.camY -= motion.dy; }
    for (const t of this.tracks) {
      t.seen = false;
      t.cx.predict(); t.cy.predict(); t.w.predict(); t.h.predict();
    }
    const high = dets.filter((d) => d.score >= this.cfg.high);
    const low = dets.filter((d) => d.score < this.cfg.high && d.score >= this.cfg.low);

    // candidates: tracks currently (approximately) in view
    const margin = 0.3;
    const near = (t: Track) => {
      const b = this.frameBox(t);
      return b.x2 > -W * margin && b.x1 < W * (1 + margin) && b.y2 > -H * margin && b.y1 < H * (1 + margin);
    };
    const cand = this.tracks.filter(near);

    // stage 1: high-confidence detections
    let { pairs, ut, ud } = this.match(cand, high, this.cfg.matchIoU);

    // drift correction from matched tracks, then retry the leftovers
    if (pairs.length >= 3) {
      const rx: number[] = [], ry: number[] = [];
      for (const [t, d] of pairs) {
        const b = this.frameBox(t);
        rx.push((d.x1 + d.x2) / 2 - (b.x1 + b.x2) / 2);
        ry.push((d.y1 + d.y2) / 2 - (b.y1 + b.y2) / 2);
      }
      const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
      this.camX -= med(rx); this.camY -= med(ry);
      const retry = this.match(ut, ud, this.cfg.matchIoU);
      pairs = pairs.concat(retry.pairs); ut = retry.ut; ud = retry.ud;
    }
    for (const [t, d] of pairs) this.apply(t, d);

    // stage 2: weak detections may only continue confirmed tracks
    const s2 = this.match(ut.filter((t) => t.confirmed), low, Math.max(0.35, this.cfg.matchIoU));
    for (const [t, d] of s2.pairs) this.apply(t, d);
    const unmatched = new Set(ut.filter((t) => !t.seen));

    // age unmatched tracks -- only where we could actually have seen them
    this.tracks = this.tracks.filter((t) => {
      if (t.seen) return true;
      const b = this.frameBox(t);
      if (!this.inView(b, W, H)) {
        t.cx.freeze(); t.cy.freeze(); t.w.freeze(); t.h.freeze(); // static world
        return t.confirmed; // tentative tracks leaving the view are forgotten
      }
      if (!unmatched.has(t)) return true;
      t.misses++;
      if (!t.confirmed) return false;
      return t.misses <= this.cfg.maxMissInView;
    });

    // new tracks from unmatched high detections that don't duplicate a live track
    for (const d of ud) {
      const dup = this.tracks.some((t) => t.seen && iou(this.frameBox(t), d) > 0.6);
      if (dup) continue;
      const cx = (d.x1 + d.x2) / 2 + this.camX, cy = (d.y1 + d.y2) / 2 + this.camY;
      const w = d.x2 - d.x1, h = d.y2 - d.y1;
      const s = Math.max(w, h);
      const t: Track = {
        key: this.nextKey++, id: 0,
        cx: new KF1(cx, 0.02 * s, 0.002 * s, 0.05 * s), cy: new KF1(cy, 0.02 * s, 0.002 * s, 0.05 * s),
        w: new KF1(w, 0.02 * s, 0.001 * s, 0.1 * s), h: new KF1(h, 0.02 * s, 0.001 * s, 0.1 * s),
        score: 0, cls: d.cls, hits: 0, misses: 0, confirmed: false, seen: false, last: d,
      };
      this.apply(t, d);
      this.tracks.push(t);
    }
    return this.view(W, H);
  }

  /** confirmed tracks to draw: detected now, or missed only briefly and still in view */
  view(W: number, H: number): TrackView[] {
    const out: TrackView[] = [];
    for (const t of this.tracks) {
      if (!t.confirmed || t.misses > 2) continue;
      const b = t.seen ? t.last : this.frameBox(t);
      if (!t.seen && !this.inView(b, W, H)) continue;
      out.push({ id: t.id, x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, score: t.score, cls: t.cls,
        mask: t.seen ? t.mask : undefined, predicted: !t.seen });
    }
    return out.sort((a, b) => a.id - b.id);
  }
}
