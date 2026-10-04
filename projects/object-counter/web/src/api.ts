/**
 * Optional backend (server/app.py). Everything in the app works without it
 * (models run in the browser); the server adds: baking custom text-prompt
 * models, storing datasets, training, and server-side accurate scans.
 */
import type { ModelInfo } from './engine/types';

export interface Health { ok: boolean; version: string; gpu: boolean; training: TrainStatus | null }
export interface TrainStatus { id: string; state: 'queued' | 'running' | 'done' | 'error'; log: string[]; model?: ModelInfo; error?: string }

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => r.statusText)}`);
  return r.json() as Promise<T>;
}

export const api = {
  async health(): Promise<Health | null> {
    try {
      const r = await fetch('api/health', { signal: AbortSignal.timeout(2500) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },
  promptModel: (prompts: string[], name?: string) =>
    fetch('api/models/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompts, name }) })
      .then((r) => j<ModelInfo>(r)),
  uploadDataset: (name: string, zip: Blob) => {
    const fd = new FormData();
    fd.append('file', zip, `${name}.zip`);
    return fetch(`api/datasets/${encodeURIComponent(name)}`, { method: 'POST', body: fd }).then((r) => j<{ name: string; images: number; classes: string[] }>(r));
  },
  train: (dataset: string, name: string, epochs: number, base?: string) =>
    fetch('api/train', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataset, name, epochs, base }) })
      .then((r) => j<TrainStatus>(r)),
  trainStatus: (id: string) => fetch(`api/train/${id}`).then((r) => j<TrainStatus>(r)),
  serverDetect: (img: Blob, modelId: string, classes: string[] | null, conf: number) => {
    const fd = new FormData();
    fd.append('file', img, 'frame.jpg');
    fd.append('model', modelId);
    fd.append('conf', String(conf));
    if (classes) fd.append('classes', JSON.stringify(classes));
    return fetch('api/detect', { method: 'POST', body: fd })
      .then((r) => j<{ dets: { x1: number; y1: number; x2: number; y2: number; score: number; cls: number }[]; ms: number }>(r));
  },
};

export async function loadManifest(): Promise<ModelInfo[]> {
  try {
    const r = await fetch(`models/manifest.json?t=${Date.now()}`);
    if (!r.ok) return [];
    const m = await r.json();
    return (m.models ?? []) as ModelInfo[];
  } catch { return []; }
}
