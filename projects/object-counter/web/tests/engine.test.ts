import { describe, expect, it } from 'vitest';
import { dropGroupBoxes, nms, postprocess, type Letterbox } from '../src/engine/decode';
import { estimateMotion, grayFrom } from '../src/tracking/gmc';
import { separate } from '../src/engine/separator';
import type { Detection } from '../src/engine/types';

const det = (x1: number, y1: number, x2: number, y2: number, score = 0.9, cls = 0): Detection => ({ x1, y1, x2, y2, score, cls });

describe('decode', () => {
  it('decodes a raw YOLO head with letterbox and NMS', () => {
    // 2 classes, 4 anchors, no masks: [1, 6, 4]
    const N = 4, C = 6, out = new Float32Array(C * N);
    const put = (n: number, cx: number, cy: number, w: number, h: number, s0: number, s1: number) => {
      out[n] = cx; out[N + n] = cy; out[2 * N + n] = w; out[3 * N + n] = h; out[4 * N + n] = s0; out[5 * N + n] = s1;
    };
    put(0, 100, 100, 50, 50, 0.9, 0.1);
    put(1, 102, 101, 50, 50, 0.8, 0.1); // duplicate of 0
    put(2, 300, 200, 40, 40, 0.1, 0.7);
    put(3, 500, 500, 10, 10, 0.05, 0.05); // below conf
    const lb: Letterbox = { r: 0.5, padX: 0, padY: 80, offX: 0, offY: 0, imgsz: 640 };
    const d = postprocess(out, [1, C, N], null, 2, { conf: 0.25, iou: 0.5, classes: null, agnostic: false }, lb, false);
    expect(d.length).toBe(2);
    expect(d[0].x1).toBeCloseTo((75 - 0) / 0.5);
    expect(d[0].y1).toBeCloseTo((75 - 80) / 0.5);
    expect(d[1].cls).toBe(1);
    const only1 = postprocess(out, [1, C, N], null, 2, { conf: 0.25, iou: 0.5, classes: [1], agnostic: false }, lb, false);
    expect(only1.length).toBe(1);
  });

  it('removes a box that encloses the whole stack', () => {
    const parts = [det(0, 0, 10, 10), det(12, 0, 22, 10), det(0, 12, 10, 22), det(12, 12, 22, 22)];
    const out = dropGroupBoxes([det(0, 0, 22, 22, 0.95), ...parts]);
    expect(out.length).toBe(4);
  });

  it('keeps overlapping boxes when masks say they are different objects', () => {
    const a = det(0, 0, 100, 100, 0.9), b = det(10, 10, 110, 110, 0.8);
    expect(nms([a, b], 0.5, true).length).toBe(1);
    expect(nms([a, b], 0.5, true, () => 0.1).length).toBe(2);
  });
});

function texture(w: number, h: number, ox: number, oy: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + ox, Y = y + oy;
    const v = 128 + 60 * Math.sin(X / 9) * Math.cos(Y / 13) + 40 * Math.sin((X + 2 * Y) / 23) + 30 * Math.sin(X / 70 + Math.cos(Y / 50));
    const i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
}

describe('global motion', () => {
  it('recovers camera translation', () => {
    const a = grayFrom(texture(640, 480, 0, 0), 640, 480);
    const b = grayFrom(texture(640, 480, 48, -20), 640, 480); // camera moved right 48, up 20 -> content moves left/down
    const t0 = performance.now();
    const m = estimateMotion(a, b);
    console.log('gmc ms', (performance.now() - t0).toFixed(1));
    expect(m.dx).toBeGreaterThan(-48 - 6); expect(m.dx).toBeLessThan(-48 + 6);
    expect(m.dy).toBeGreaterThan(20 - 6); expect(m.dy).toBeLessThan(20 + 6);
  });
});

describe('separator', () => {
  it('splits a grid of touching-ish bright blocks into individual items', () => {
    const W = 400, H = 260, px = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 40; px[i * 4 + 3] = 255; }
    let n = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      n++;
      const x0 = 20 + c * 60, y0 = 20 + r * 45;
      for (let y = y0; y < y0 + 40; y++) for (let x = x0; x < x0 + 56; x++) {
        const i = (y * W + x) * 4, v = 190 + ((x * 7 + y * 13) % 30);
        px[i] = v; px[i + 1] = v * 0.8; px[i + 2] = v * 0.5;
      }
    }
    const d = separate(px, W, H, { sensitivity: 0.5, polarity: 'auto' }, true);
    expect(d.length).toBe(n);
    expect(d.every((x) => x.mask && x.mask.data.some((v) => v))).toBe(true);
  });
});
