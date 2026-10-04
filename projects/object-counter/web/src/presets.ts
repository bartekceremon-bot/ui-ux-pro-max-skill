/**
 * Object types the user can count and how each one maps onto the available
 * detection engines.
 *
 * Engine resolution for a preset (first hit wins):
 *   1. the user's explicit choice for this preset (Zmień obiekt -> Silnik)
 *   2. a *trained* model (source "trained") having one of the preset's class names
 *   3. any other model having one of the class names (e.g. open-vocabulary YOLOE)
 *   4. the model-free Separator, if it suits the object (end-on stacks)
 *
 * Adding a dedicated model is therefore zero-code: train it with class name
 * "board" (or "deska"), export, and the "Deski" preset picks it up.
 */
import type { ModelInfo } from './engine/types';

export interface Preset {
  id: string;
  label: string;
  /** upper-case singular for the info panel ("Obiekt: DESKA") */
  noun: string;
  icon: string;
  /** class names to look for in model manifests (case-insensitive) */
  names: string[];
  /** Separator fallback makes sense (items seen end-on with gaps between them) */
  cvOk: boolean;
}

export const PRESETS: Preset[] = [
  { id: 'boards', label: 'Deski', noun: 'DESKA', icon: 'boards', cvOk: true,
    names: ['board', 'deska', 'plank', 'wooden board', 'wooden plank', 'end of a wooden board', 'lumber', 'board_end'] },
  { id: 'boxes', label: 'Kartony', noun: 'KARTON', icon: 'box', cvOk: false,
    names: ['box', 'karton', 'carton', 'cardboard box'] },
  { id: 'parcels', label: 'Paczki', noun: 'PACZKA', icon: 'package', cvOk: false,
    names: ['parcel', 'paczka', 'package', 'box', 'cardboard box'] },
  { id: 'pallets', label: 'Palety', noun: 'PALETA', icon: 'pallet', cvOk: false,
    names: ['pallet', 'paleta', 'wooden pallet'] },
  { id: 'pipes', label: 'Rury', noun: 'RURA', icon: 'pipe', cvOk: true,
    names: ['pipe', 'rura', 'tube', 'end of a pipe'] },
  { id: 'custom', label: 'Własny obiekt', noun: 'OBIEKT', icon: 'custom', cvOk: true, names: [] },
];

export type EngineChoice =
  | { engine: 'yolo'; modelId: string; classNames: string[] }
  | { engine: 'cv' };

export interface Resolved {
  choice: EngineChoice;
  model: ModelInfo | null;
  /** class indices within the model */
  classes: number[] | null;
  why: string;
}

const lc = (s: string) => s.trim().toLowerCase();

export function classIndices(model: ModelInfo, names: string[]): number[] {
  const want = new Set(names.map(lc));
  return model.classes.map((c, i) => (want.has(lc(c)) ? i : -1)).filter((i) => i >= 0);
}

export function resolve(preset: Preset, models: ModelInfo[], override: EngineChoice | null): Resolved {
  if (override?.engine === 'cv') return { choice: override, model: null, classes: null, why: 'wybór użytkownika' };
  if (override?.engine === 'yolo') {
    const m = models.find((x) => x.id === override.modelId);
    if (m) {
      const idx = override.classNames.length ? classIndices(m, override.classNames) : null;
      return { choice: override, model: m, classes: idx && idx.length ? idx : null, why: 'wybór użytkownika' };
    }
  }
  const ranked = [...models].sort((a, b) => Number(b.source === 'trained') - Number(a.source === 'trained'));
  for (const m of ranked) {
    const idx = classIndices(m, preset.names);
    if (idx.length) {
      return {
        choice: { engine: 'yolo', modelId: m.id, classNames: idx.map((i) => m.classes[i]) },
        model: m, classes: idx,
        why: m.source === 'trained' ? 'dedykowany model' : 'model ogólny',
      };
    }
  }
  return { choice: { engine: 'cv' }, model: null, classes: null, why: 'brak modelu – Separator' };
}

const KEY = 'oc.engine.';
export function loadOverride(presetId: string): EngineChoice | null {
  try { return JSON.parse(localStorage.getItem(KEY + presetId) ?? 'null'); } catch { return null; }
}
export function saveOverride(presetId: string, c: EngineChoice | null) {
  try { c ? localStorage.setItem(KEY + presetId, JSON.stringify(c)) : localStorage.removeItem(KEY + presetId); } catch { /* private mode */ }
}
