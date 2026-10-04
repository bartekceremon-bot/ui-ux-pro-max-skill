/**
 * Main-thread facade over the inference worker.
 *
 * Live mode uses "latest frame wins" back-pressure: while a frame is being
 * analysed, newer frames are not queued (they would only add latency), so the
 * camera preview stays smooth and results are never older than one inference.
 */
import type { DetectOptions, DetectResult, ModelInfo } from './types';

export class Detector {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: DetectResult) => void; reject: (e: Error) => void }>();
  private loadWaiter: { resolve: (b: string) => void; reject: (e: Error) => void } | null = null;
  busy = false;
  backend = 'none';
  model: ModelInfo | null = null;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'log') console.info('[worker]', m.msg);
      else if (m.type === 'loaded') { this.backend = m.backend; this.loadWaiter?.resolve(m.backend); this.loadWaiter = null; }
      else if (m.type === 'result') { this.pending.get(m.id)?.resolve(m.res); this.pending.delete(m.id); }
      else if (m.type === 'error') {
        const err = new Error(m.error);
        if (m.id != null && this.pending.has(m.id)) { this.pending.get(m.id)!.reject(err); this.pending.delete(m.id); }
        else if (this.loadWaiter) { this.loadWaiter.reject(err); this.loadWaiter = null; }
        else console.error(err);
      }
    };
  }

  load(model: ModelInfo, url: string, prefer: 'webgpu' | 'wasm' | 'auto' = 'auto'): Promise<string> {
    this.model = null;
    return new Promise<string>((resolve, reject) => {
      this.loadWaiter = { resolve, reject };
      const ortBase = new URL('ort/', document.baseURI).href;
      this.worker.postMessage({ type: 'load', model, url: new URL(url, document.baseURI).href, prefer, ortBase });
    }).then((b) => { this.model = model; return b; });
  }

  /** Analyse one frame. The bitmap is transferred (and closed) by the worker. */
  detect(bitmap: ImageBitmap, opts: DetectOptions): Promise<DetectResult> {
    const id = this.nextId++;
    this.busy = true;
    return new Promise<DetectResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'detect', id, bitmap, opts }, [bitmap]);
    }).finally(() => { this.busy = this.pending.size > 0; });
  }
}
