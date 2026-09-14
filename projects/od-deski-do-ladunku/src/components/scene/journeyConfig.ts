export type Beat = {
  id: string;
  start: number;
  end: number;
  kicker: string;
  line: string;
  /** Small chips shown next to the line, e.g. part names in the components scene. */
  chips?: string[];
};

/**
 * The scroll timeline, kept in one table so copy and 3D can never drift apart.
 *
 * The story opens on the exploded pallet rather than on raw timber: that suspended part diagram
 * is the page's poster image, and it states the brief's first rule -- every element is its own
 * object -- in the first frame. The material chapter that used to run in front of it now has its
 * own section, where a reader can actually stop and read it.
 */
export const BEATS: Beat[] = [
  {
    id: 'elementy',
    start: 0,
    end: 0.2,
    kicker: '01 — Elementy',
    line: 'Każdy element ma swoją funkcję.',
    chips: ['Deski górne', 'Wsporniki nośne', 'Klocki', 'Deski dolne'],
  },
  { id: 'montaz', start: 0.2, end: 0.42, kicker: '02 — Montaż', line: 'Paleta powstaje element po elemencie.' },
  {
    id: 'paleta',
    start: 0.42,
    end: 0.56,
    kicker: '03 — Gotowa paleta',
    line: 'Gotowa do pracy.',
    chips: ['Wymiary [WYMIAR]', 'Nośność [NOŚNOŚĆ]', 'Waga [WAGA]'],
  },
  {
    id: 'towar',
    start: 0.56,
    end: 0.8,
    kicker: '04 — Towar',
    line: 'Ładunek układany warstwa po warstwie.',
    chips: ['Układ kolumnowy', 'Pełne podparcie', 'Bez nawisu'],
  },
  { id: 'ladunek', start: 0.8, end: 1.0001, kicker: '05 — Ładunek', line: 'Paleta. Ładunek. Gotowe do drogi.' },
];

export function beatAt(t: number): Beat {
  return BEATS.find((b) => t >= b.start && t < b.end) ?? BEATS[BEATS.length - 1];
}

function span(t: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export type Phases = {
  timber: number;
  boards: number;
  components: number;
  assembly: number;
  cartons: number;
  film: number;
  approach: number;
  lift: number;
};

/**
 * One place that turns scroll progress into every animated quantity in the scene. Phases overlap
 * slightly on purpose: a hand-off that starts before the previous move finishes reads as a
 * continuous process rather than a slideshow of states.
 */
export function phasesAt(t: number): Phases {
  return {
    // The raw-timber set belongs to the material section now, so the journey never shows it.
    timber: 0,
    // Boards and components open already spawned: the first frame is the exploded diagram.
    boards: 1,
    components: 1,
    assembly: span(t, 0.2, 0.44),
    cartons: span(t, 0.56, 0.78),
    film: span(t, 0.78, 0.855),
    approach: span(t, 0.83, 0.92),
    lift: span(t, 0.92, 1),
  };
}

export type CameraKey = {
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /**
   * Pure horizontal pan, in metres along the camera's own right axis. The hero needs the product
   * sitting right of centre so the headline has clean space, and panning keeps the framing honest
   * — moving the look-at target instead would swing the camera and change the angle.
   */
  shift?: number;
};

/**
 * One continuous sweep: close on the material, up for the layout, round the product, then back
 * for the finished load. Wide -> close -> side -> top -> exploded -> assembly -> hero, with no
 * direction changes inside a beat.
 */
export const CAMERA_PATH: CameraKey[] = [
  // The exploded diagram is roughly two metres across, so the opening frame stands well back;
  // the camera only closes in once the parts have collapsed into a 1.2 m pallet.
  { t: 0.0, position: [2.85, 1.78, 3.55], target: [0, 0.3, 0], fov: 25, shift: -0.45 },
  { t: 0.14, position: [2.5, 1.5, 3.1], target: [0, 0.22, 0], fov: 27, shift: -0.2 },
  { t: 0.26, position: [2.35, 1.55, 2.5], target: [0, 0.14, 0], fov: 31 },
  { t: 0.38, position: [2.0, 0.98, 2.0], target: [0, 0.12, 0], fov: 31 },
  { t: 0.48, position: [1.46, 0.46, 1.5], target: [0, 0.1, 0], fov: 31 },
  { t: 0.58, position: [-1.72, 0.74, 1.82], target: [0, 0.13, 0], fov: 33 },
  { t: 0.74, position: [-1.6, 1.52, 2.62], target: [0, 0.46, 0], fov: 34 },
  { t: 0.88, position: [0.3, 1.72, 3.85], target: [0.05, 0.56, 0], fov: 30 },
  { t: 1.0, position: [2.2, 1.9, 5.05], target: [0.5, 0.62, 0], fov: 27 },
];
function smoothstep(x: number) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export function sampleCamera(t: number) {
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
  const f = smoothstep((clamped - a.t) / (b.t - a.t || 1));
  const shift = (a.shift ?? 0) + ((b.shift ?? 0) - (a.shift ?? 0)) * f;
  const mix = (p: [number, number, number], q: [number, number, number]): [number, number, number] => [
    p[0] + (q[0] - p[0]) * f,
    p[1] + (q[1] - p[1]) * f,
    p[2] + (q[2] - p[2]) * f,
  ];
  return {
    position: mix(a.position, b.position),
    target: mix(a.target, b.target),
    fov: a.fov + (b.fov - a.fov) * f,
    shift,
  };
}
