/** Drawing of boxes, numbers, confidence and instance masks over the image. */
import type { InstanceMask } from './engine/types';

export interface DrawItem {
  num: number;
  x1: number; y1: number; x2: number; y2: number;
  score: number;
  mask?: InstanceMask;
  predicted?: boolean;
  removed?: boolean;
  manual?: boolean;
}

export const confColor = (s: number) => (s >= 0.7 ? '#22C55E' : s >= 0.45 ? '#FACC15' : '#EF4444');
const rgb = (s: number): [number, number, number] => (s >= 0.7 ? [34, 197, 94] : s >= 0.45 ? [250, 204, 21] : [239, 68, 68]);

/** maps source-image px to canvas px for an object-fit: contain view */
export interface View { scale: number; ox: number; oy: number }

export function containView(srcW: number, srcH: number, cw: number, ch: number): View {
  const scale = Math.min(cw / srcW, ch / srcH);
  return { scale, ox: (cw - srcW * scale) / 2, oy: (ch - srcH * scale) / 2 };
}

let maskCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;

function drawMasks(ctx: CanvasRenderingContext2D, items: DrawItem[], v: View, srcW: number, srcH: number) {
  const k = 4; // mask layer = 1/4 of source resolution
  const lw = Math.ceil(srcW / k), lh = Math.ceil(srcH / k);
  if (!maskCanvas) maskCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(lw, lh) : document.createElement('canvas');
  if (maskCanvas.width !== lw || maskCanvas.height !== lh) { maskCanvas.width = lw; maskCanvas.height = lh; }
  const mctx = maskCanvas.getContext('2d') as CanvasRenderingContext2D;
  const img = mctx.createImageData(lw, lh);
  const px = img.data;
  let any = false;
  for (const it of items) {
    const m = it.mask;
    if (!m || it.removed) continue;
    any = true;
    const [r, g, b] = rgb(it.score);
    const x0 = Math.max(0, Math.floor(Math.max(m.x, it.x1) / k)), x1 = Math.min(lw, Math.ceil(Math.min(m.x + m.w * m.scale, it.x2) / k));
    const y0 = Math.max(0, Math.floor(Math.max(m.y, it.y1) / k)), y1 = Math.min(lh, Math.ceil(Math.min(m.y + m.h * m.scale, it.y2) / k));
    for (let y = y0; y < y1; y++) {
      const my = Math.floor((y * k + k / 2 - m.y) / m.scale);
      if (my < 0 || my >= m.h) continue;
      for (let x = x0; x < x1; x++) {
        const mx = Math.floor((x * k + k / 2 - m.x) / m.scale);
        if (mx < 0 || mx >= m.w || !m.data[my * m.w + mx]) continue;
        const i = (y * lw + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 90;
      }
    }
  }
  if (!any) return;
  mctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(maskCanvas as CanvasImageSource, v.ox, v.oy, srcW * v.scale, srcH * v.scale);
}

export function drawItems(ctx: CanvasRenderingContext2D, items: DrawItem[], v: View, srcW: number, srcH: number,
                          opts: { masks: boolean; labels: boolean; conf: boolean }) {
  if (opts.masks) drawMasks(ctx, items, v, srcW, srcH);
  const n = items.length;
  const dpr = window.devicePixelRatio || 1;
  // keep labels legible but don't let them cover small objects in dense stacks
  const font = Math.round((n > 80 ? 10 : n > 30 ? 12 : 14) * dpr);
  ctx.font = `700 ${font}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'top';
  for (const it of items) {
    const x = v.ox + it.x1 * v.scale, y = v.oy + it.y1 * v.scale;
    const w = (it.x2 - it.x1) * v.scale, h = (it.y2 - it.y1) * v.scale;
    const col = it.removed ? '#94A3B8' : it.manual ? '#38BDF8' : confColor(it.score);
    ctx.lineWidth = Math.max(2, 2.5 * dpr) * (it.predicted ? 0.6 : 1);
    ctx.strokeStyle = '#000000aa';
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.strokeStyle = col;
    ctx.setLineDash(it.removed || it.predicted ? [6 * dpr, 4 * dpr] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    if (it.removed) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
      continue;
    }
    if (!opts.labels) continue;
    const text = opts.conf && !it.manual ? `#${it.num} ${Math.round(it.score * 100)}%` : `#${it.num}`;
    const tw = ctx.measureText(text).width + 8 * dpr, th = font + 6 * dpr;
    // inside the box when it is tall enough, else above it
    const ly = h > th * 2.2 ? y + 2 : Math.max(0, y - th - 1);
    ctx.fillStyle = col;
    ctx.fillRect(x, ly, Math.min(tw, Math.max(w, tw)), th);
    ctx.fillStyle = '#0B0F14';
    ctx.fillText(text, x + 4 * dpr, ly + 3 * dpr);
  }
}

export function drawRoi(ctx: CanvasRenderingContext2D, roi: { x1: number; y1: number; x2: number; y2: number }, v: View, srcW: number, srcH: number) {
  const x = v.ox + roi.x1 * v.scale, y = v.oy + roi.y1 * v.scale, w = (roi.x2 - roi.x1) * v.scale, h = (roi.y2 - roi.y1) * v.scale;
  ctx.fillStyle = '#00000080';
  const X = v.ox, Y = v.oy, W = srcW * v.scale, H = srcH * v.scale;
  ctx.fillRect(X, Y, W, y - Y); ctx.fillRect(X, y + h, W, Y + H - y - h);
  ctx.fillRect(X, y, x - X, h); ctx.fillRect(x + w, y, X + W - x - w, h);
  ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
  ctx.setLineDash([10, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
}

/** Reading-order numbering: rows top-to-bottom, left-to-right inside a row. */
export function readingOrder<T extends { x1: number; y1: number; x2: number; y2: number }>(items: T[]): T[] {
  if (items.length < 2) return items.slice();
  const hs = items.map((d) => d.y2 - d.y1).sort((a, b) => a - b);
  const tol = hs[hs.length >> 1] * 0.5;
  const byY = items.slice().sort((a, b) => (a.y1 + a.y2) - (b.y1 + b.y2));
  const rows: T[][] = [];
  let rowY = -Infinity;
  for (const d of byY) {
    const cy = (d.y1 + d.y2) / 2;
    if (cy - rowY > tol) { rows.push([]); rowY = cy; }
    rows[rows.length - 1].push(d);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x1 - b.x1));
}
