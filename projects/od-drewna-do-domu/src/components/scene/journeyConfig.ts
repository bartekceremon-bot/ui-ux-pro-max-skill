export type Beat = {
  id: string;
  label: string;
  /** Scroll fraction [0,1] within the pinned journey section where this beat owns the frame. */
  start: number;
  end: number;
  kicker: string;
  line: string;
};

/** Mirrors the brief's scroll percentages 1:1 so copy, camera and 3D reveals stay in lockstep. */
export const BEATS: Beat[] = [
  { id: 'las', label: 'Las', start: 0, end: 0.15, kicker: '01 — Las', line: 'Każdy dom zaczyna się od materiału.' },
  { id: 'drewno', label: 'Drewno', start: 0.15, end: 0.3, kicker: '02 — Drewno', line: 'Znamy drewno, zanim stanie się konstrukcją.' },
  { id: 'przecieranie', label: 'Przecieranie', start: 0.3, end: 0.45, kicker: '03 — Przecieranie', line: 'Z surowca tworzymy materiał.' },
  { id: 'obrobka', label: 'Obróbka', start: 0.45, end: 0.6, kicker: '04 — Selekcja', line: 'Każdy element ma swoje miejsce w konstrukcji.' },
  { id: 'budowa', label: 'Budowa', start: 0.6, end: 0.8, kicker: '05 — Budowa', line: 'Obserwujesz powstawanie prawdziwego domu.' },
  { id: 'dom', label: 'Dom', start: 0.8, end: 1.0, kicker: '06 — Dom', line: 'Od drewna. Do miejsca, które można nazwać domem.' },
];

export function beatAt(t: number): Beat {
  return BEATS.find((b) => t >= b.start && t < b.end) ?? BEATS[BEATS.length - 1];
}

/** How far within its own beat t sits, eased 0..1 — what each 3D set uses to drive local reveals. */
export function localProgress(t: number, beat: Beat): number {
  const span = beat.end - beat.start || 1;
  return Math.min(1, Math.max(0, (t - beat.start) / span));
}

export type CameraKey = {
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
};

/**
 * One dolly through a corridor of five sets, each ~14 units apart on -Z.
 * Movement is a plain forward move with gentle vertical/lateral drift per beat —
 * "cinematic, spokojne ruchy, żadnego chaotycznego obracania".
 */
export const CAMERA_PATH: CameraKey[] = [
  { t: 0.0, position: [0, 1.7, 8], target: [0, 1.6, 0], fov: 42 },
  { t: 0.15, position: [1.4, 1.75, -3], target: [0, 2.2, -8], fov: 40 },
  { t: 0.3, position: [1.1, 1.9, -10], target: [-0.3, 2.6, -14], fov: 38 },
  { t: 0.45, position: [2.2, 2.1, -19], target: [0.2, 1.6, -24], fov: 40 },
  // Lifted well above the sawmill's blade-frame (posts top out at y ≈ 2.4) while it crosses
  // z ≈ -22: at the sawmill's own height the path there ran the camera almost through a post.
  { t: 0.52, position: [3.2, 4.8, -22], target: [0.3, 2, -27], fov: 39 },
  { t: 0.6, position: [-2.4, 1.8, -30], target: [0.4, 1.9, -35], fov: 40 },
  { t: 0.72, position: [4.2, 2.4, -38], target: [0.6, 2.2, -44], fov: 36 },
  { t: 0.85, position: [6.5, 3.4, -46], target: [0.6, 2.4, -50], fov: 34 },
  { t: 1.0, position: [9.5, 4.6, -54], target: [0.6, 2.6, -50], fov: 32 },
];

export function sampleCamera(t: number): { position: [number, number, number]; target: [number, number, number]; fov: number } {
  const clamped = Math.min(1, Math.max(0, t));
  let a = CAMERA_PATH[0];
  let b = CAMERA_PATH[CAMERA_PATH.length - 1];
  for (let i = 0; i < CAMERA_PATH.length - 1; i++) {
    if (clamped >= CAMERA_PATH[i].t && clamped <= CAMERA_PATH[i + 1].t) {
      a = CAMERA_PATH[i];
      b = CAMERA_PATH[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const f = smoothstep(Math.min(1, Math.max(0, (clamped - a.t) / span)));
  const lerp3 = (p: [number, number, number], q: [number, number, number]): [number, number, number] => [
    p[0] + (q[0] - p[0]) * f,
    p[1] + (q[1] - p[1]) * f,
    p[2] + (q[2] - p[2]) * f,
  ];
  return {
    position: lerp3(a.position, b.position),
    target: lerp3(a.target, b.target),
    fov: (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * f,
  };
}

function smoothstep(x: number): number {
  return x * x * (3 - 2 * x);
}

/** World-space anchor of each set along the corridor; kept here so overlays and 3D agree. */
export const SET_Z = {
  forest: 0,
  tree: -12,
  sawmill: -22,
  selection: -32,
  house: -46,
} as const;
