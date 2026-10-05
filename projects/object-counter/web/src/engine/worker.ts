/// <reference lib="webworker" />
/**
 * Inference worker. Keeps the UI thread free: frames arrive as ImageBitmaps
 * (zero-copy transfer), are letterboxed on an OffscreenCanvas, run through
 * ONNX Runtime Web (WebGPU when available, multi-threaded WASM otherwise) and
 * decoded into detections. The model-free Separator runs here too.
 *
 * "Accurate" mode (Policz / Zdjęcie) runs the full frame *and* a grid of
 * overlapping tiles at native resolution, then merges them -- small, densely
 * packed items (board ends in a big stack) are much better resolved that way.
 */
import * as ort from 'onnxruntime-web/webgpu';
import { dropGroupBoxes, ioMin, nms, postprocess, stackFilter, type Letterbox, type Protos } from './decode';
import { separate } from './separator';
import type { DetectOptions, DetectResult, Detection, ModelInfo } from './types';

type InMsg =
  | { type: 'load'; model: ModelInfo; url: string; prefer: 'webgpu' | 'wasm' | 'auto'; ortBase: string }
  | { type: 'detect'; id: number; bitmap: ImageBitmap; opts: DetectOptions };

let session: ort.InferenceSession | null = null;
let model: ModelInfo | null = null;
let backend = 'none';
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

function getCtx(w: number, h: number): OffscreenCanvasRenderingContext2D {
  if (!canvas) {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  }
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return ctx!;
}

/**
 * `navigator.gpu` can exist without a usable adapter (headless, blocklisted
 * GPU), or with a software "fallback" adapter (SwiftShader) that is far slower
 * than multi-threaded WASM -- use WebGPU only on real hardware.
 */
async function hasWebGpu(): Promise<boolean> {
  type Adapter = { isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean; architecture?: string; vendor?: string } };
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await Promise.race([gpu.requestAdapter(), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
    if (!adapter) return false;
    const info = adapter.info ?? {};
    if (adapter.isFallbackAdapter || info.isFallbackAdapter) return false;
    if (/swiftshader/i.test(`${info.architecture ?? ''} ${info.vendor ?? ''}`)) return false;
    return true;
  } catch { return false; }
}

async function load(m: ModelInfo, url: string, prefer: 'webgpu' | 'wasm' | 'auto'): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  self.postMessage({ type: 'log', msg: `fetched ${buf.byteLength}` });
  const tries: string[] = prefer !== 'wasm' && (await hasWebGpu()) ? ['webgpu', 'wasm'] : ['wasm'];
  let lastErr: unknown;
  for (const ep of tries) {
    try {
      self.postMessage({ type: 'log', msg: `try ${ep} threads=${ort.env.wasm.numThreads} coi=${self.crossOriginIsolated}` });
      session?.release();
      session = await ort.InferenceSession.create(buf, {
        executionProviders: [ep],
        graphOptimizationLevel: 'all',
      });
      self.postMessage({ type: 'log', msg: `session ok ${ep}` });
      backend = ep === 'wasm' ? `wasm×${ort.env.wasm.numThreads}` : 'webgpu';
      model = m;
      // warm-up: first run compiles kernels / shaders
      const s = m.imgsz;
      await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', new Float32Array(3 * s * s), [1, 3, s, s]) });
      return backend;
    } catch (e) {
      self.postMessage({ type: 'log', msg: `fail ${ep}: ${e}` });
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Letterbox a source rectangle into the model input and build the CHW tensor. */
function preprocess(src: ImageBitmap, sx: number, sy: number, sw: number, sh: number, s: number) {
  const r = Math.min(s / sw, s / sh);
  const nw = Math.round(sw * r), nh = Math.round(sh * r);
  const padX = (s - nw) / 2, padY = (s - nh) / 2;
  const c = getCtx(s, s);
  c.fillStyle = 'rgb(114,114,114)';
  c.fillRect(0, 0, s, s);
  c.drawImage(src, sx, sy, sw, sh, padX, padY, nw, nh);
  const px = c.getImageData(0, 0, s, s).data;
  const area = s * s;
  const t = new Float32Array(3 * area);
  for (let i = 0, j = 0; i < area; i++, j += 4) {
    t[i] = px[j] / 255;
    t[area + i] = px[j + 1] / 255;
    t[2 * area + i] = px[j + 2] / 255;
  }
  const lb: Letterbox = { r, padX, padY, offX: sx, offY: sy, imgsz: s };
  return { tensor: new ort.Tensor('float32', t, [1, 3, s, s]), lb };
}

async function runYolo(src: ImageBitmap, sx: number, sy: number, sw: number, sh: number, o: DetectOptions): Promise<Detection[]> {
  if (!session || !model) throw new Error('model not loaded');
  const { tensor, lb } = preprocess(src, sx, sy, sw, sh, model.imgsz);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const o0 = out[session.outputNames[0]];
  const o1 = session.outputNames[1] ? out[session.outputNames[1]] : undefined;
  const data0 = (await o0.getData()) as Float32Array;
  let protos: Protos | null = null;
  if (o1) {
    const [, nm, ph, pw] = o1.dims as number[];
    protos = { data: (await o1.getData()) as Float32Array, nm, ph, pw };
  }
  const nc = (o0.dims[1] as number) - 4 - (protos ? protos.nm : 0);
  const dets = postprocess(data0, o0.dims as number[], protos, nc,
    { conf: o.conf, iou: o.iou, classes: o.classes, agnostic: o.agnostic, maxDet: 1000 }, lb, o.masks);
  tensor.dispose(); o0.dispose(); o1?.dispose();
  return dets;
}

/** Overlapping tile grid at roughly native model resolution. */
export function tileGrid(W: number, H: number, tile: number, overlap = 0.25) {
  const tiles: { x: number; y: number; w: number; h: number }[] = [];
  if (Math.max(W, H) <= tile * 1.15) return tiles; // full-frame pass is already ~native
  const step = tile * (1 - overlap);
  const nx = Math.max(1, Math.ceil((W - tile) / step) + 1);
  const ny = Math.max(1, Math.ceil((H - tile) / step) + 1);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const w = Math.min(tile, W), h = Math.min(tile, H);
      const x = nx === 1 ? 0 : Math.round((i * (W - w)) / (nx - 1));
      const y = ny === 1 ? 0 : Math.round((j * (H - h)) / (ny - 1));
      tiles.push({ x, y, w, h });
    }
  }
  return tiles;
}

async function detectAccurate(src: ImageBitmap, o: DetectOptions): Promise<Detection[]> {
  const W = src.width, H = src.height, s = model!.imgsz;
  const all: Detection[] = await runYolo(src, 0, 0, W, H, o);
  // tile size in source px: native resolution, but never more than ~5x5 tiles
  const tile = Math.max(s, Math.ceil(Math.max(W, H) / 4));
  for (const t of tileGrid(W, H, tile)) {
    const dets = await runYolo(src, t.x, t.y, t.w, t.h, o);
    const m = 3; // drop boxes cut by an *inner* tile edge; the neighbour tile has them whole
    for (const d of dets) {
      if ((d.x1 <= t.x + m && t.x > 0) || (d.y1 <= t.y + m && t.y > 0) ||
          (d.x2 >= t.x + t.w - m && t.x + t.w < W) || (d.y2 >= t.y + t.h - m && t.y + t.h < H)) continue;
      all.push(d);
    }
  }
  let merged = nms(all, Math.min(o.iou, 0.5), o.agnostic);
  // remove partial duplicates (a fragment inside a full detection)
  merged = merged.filter((d) => !merged.some((e) => e !== d && e.score >= d.score * 0.8 &&
    (e.x2 - e.x1) * (e.y2 - e.y1) > (d.x2 - d.x1) * (d.y2 - d.y1) && ioMin(d, e) > 0.85));
  return dropGroupBoxes(merged);
}

function detectCv(src: ImageBitmap, o: DetectOptions): Detection[] {
  // working resolution: enough to resolve thin board ends, small enough for live use
  const maxSide = o.tiled ? 960 : 512;
  const k = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.round(src.width * k), h = Math.round(src.height * k);
  const c = getCtx(w, h);
  c.drawImage(src, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h);
  const dets = separate(img.data, w, h, o.cv, o.masks);
  const inv = 1 / k;
  for (const d of dets) {
    d.x1 *= inv; d.y1 *= inv; d.x2 *= inv; d.y2 *= inv;
    if (d.mask) { d.mask.x *= inv; d.mask.y *= inv; d.mask.scale *= inv; }
  }
  return dets;
}

function inRoi(d: Detection, roi: DetectOptions['roi']): boolean {
  if (!roi) return true;
  const cx = (d.x1 + d.x2) / 2, cy = (d.y1 + d.y2) / 2;
  return cx >= roi.x1 && cx <= roi.x2 && cy >= roi.y1 && cy <= roi.y2;
}

// ONNX sessions are not re-entrant: a "Policz" request arriving while a live
// frame is still running must wait, so messages are processed strictly in order.
let queue: Promise<void> = Promise.resolve();
self.onmessage = (ev: MessageEvent<InMsg>) => {
  queue = queue.then(() => handle(ev.data));
};

async function handle(msg: InMsg) {
  try {
    if (msg.type === 'load') {
      ort.env.wasm.wasmPaths = msg.ortBase; // runtime files served by the app (public/ort)
      const b = await load(msg.model, msg.url, msg.prefer);
      self.postMessage({ type: 'loaded', backend: b, model: msg.model.id });
      return;
    }
    if (msg.type === 'detect') {
      const t0 = performance.now();
      const { bitmap, opts } = msg;
      let dets: Detection[];
      if (opts.engine === 'cv') dets = detectCv(bitmap, opts);
      else dets = opts.tiled ? await detectAccurate(bitmap, opts) : await runYolo(bitmap, 0, 0, bitmap.width, bitmap.height, opts);
      dets = dets.filter((d) => inRoi(d, opts.roi));
      if (opts.stack) dets = stackFilter(dets);
      const res: DetectResult = {
        dets, ms: performance.now() - t0, width: bitmap.width, height: bitmap.height,
        backend: opts.engine === 'cv' ? 'cv' : backend,
      };
      bitmap.close();
      const transfer = dets.flatMap((d) => (d.mask ? [d.mask.data.buffer as ArrayBuffer] : []));
      self.postMessage({ type: 'result', id: msg.id, res }, transfer);
    }
  } catch (e) {
    if (msg.type === 'detect') msg.bitmap.close();
    self.postMessage({ type: 'error', id: (msg as { id?: number }).id, error: String((e as Error)?.message ?? e) });
  }
}
