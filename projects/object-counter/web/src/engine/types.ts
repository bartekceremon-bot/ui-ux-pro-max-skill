/** A single detected object instance in source-image pixel coordinates. */
export interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  cls: number;
  /** Instance mask covering the box: `w*h` bytes (0/1) at `(x, y)` in source pixels / `scale`. */
  mask?: InstanceMask;
}

export interface InstanceMask {
  /** left/top of the mask grid in source pixels */
  x: number;
  y: number;
  /** grid size in cells */
  w: number;
  h: number;
  /** source pixels per cell */
  scale: number;
  data: Uint8Array;
}

export type EngineKind = 'yolo' | 'cv';

export interface ModelInfo {
  id: string;
  name: string;
  file: string;
  task: 'segment' | 'detect';
  imgsz: number;
  classes: string[];
  source: string;
  sizeMB?: number;
  metrics?: Record<string, number>;
  created?: string;
  /** demo model (e.g. trained on synthetic data): listed, but never picked automatically */
  demo?: boolean;
  /** recommended confidence threshold for this model (calibrated on held-out photos) */
  conf?: number;
}

export interface CvOptions {
  /** 0..1, higher = more objects split / lower contrast accepted */
  sensitivity: number;
  /** 'auto' picks the polarity with the more regular result */
  polarity: 'auto' | 'bright' | 'dark' | 'edges';
}

export interface DetectOptions {
  engine: EngineKind;
  conf: number;
  iou: number;
  /** class indices to keep (null = all) */
  classes: number[] | null;
  /** accurate mode: full image + overlapping tiles, merged */
  tiled: boolean;
  masks: boolean;
  /** treat all kept classes as one object type for NMS (synonym prompts) */
  agnostic: boolean;
  /** region of interest in source pixels; detections whose centre is outside are dropped */
  roi: { x1: number; y1: number; x2: number; y2: number } | null;
  cv: CvOptions;
}

export interface DetectResult {
  dets: Detection[];
  /** inference wall time in ms (worker side) */
  ms: number;
  width: number;
  height: number;
  backend: string;
}
