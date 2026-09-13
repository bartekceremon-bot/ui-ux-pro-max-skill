export type Beat = {
  id: string;
  start: number;
  end: number;
  kicker: string;
  line: string;
  /** Small chips shown next to the line, e.g. part names in the components scene. */
  chips?: string[];
};

/** The scroll timeline from the brief, kept in one table so copy and 3D can never drift apart. */
export const BEATS: Beat[] = [
  { id: 'drewno', start: 0, end: 0.15, kicker: '01 — Drewno', line: 'Każda paleta zaczyna się od drewna.' },
  { id: 'deski', start: 0.15, end: 0.3, kicker: '02 — Deski', line: 'Precyzyjnie przygotowany materiał.' },
  {
    id: 'elementy',
    start: 0.3,
    end: 0.45,
    kicker: '03 — Elementy',
    line: 'Każdy element ma swoją funkcję.',
    chips: ['Deski górne', 'Wsporniki nośne', 'Klocki', 'Deski dolne'],
  },
  { id: 'montaz', start: 0.45, end: 0.65, kicker: '04 — Montaż', line: 'Paleta powstaje element po elemencie.' },
  {
    id: 'paleta',
    start: 0.65,
    end: 0.75,
    kicker: '05 — Gotowa paleta',
    line: 'Gotowa do pracy.',
    chips: ['Wymiary [WYMIAR]', 'Nośność [NOŚNOŚĆ]', 'Waga [WAGA]'],
  },
  {
    id: 'towar',
    start: 0.75,
    end: 0.9,
    kicker: '06 — Towar',
    line: 'Ładunek układany warstwa po warstwie.',
    chips: ['Układ kolumnowy', 'Pełne podparcie', 'Bez nawisu'],
  },
  { id: 'ladunek', start: 0.9, end: 1.0001, kicker: '07 — Ładunek', line: 'Paleta. Ładunek. Gotowe do drogi.' },
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
    timber: 1 - span(t, 0.125, 0.2),
    boards: span(t, 0.15, 0.31),
    components: span(t, 0.3, 0.46),
    assembly: span(t, 0.45, 0.66),
    cartons: span(t, 0.75, 0.885),
    film: span(t, 0.885, 0.945),
    approach: span(t, 0.915, 0.97),
    lift: span(t, 0.965, 1),
  };
}

export type CameraKey = {
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

/**
 * One continuous sweep: close on the material, up for the layout, round the product, then back
 * for the finished load. Wide -> close -> side -> top -> exploded -> assembly -> hero, with no
 * direction changes inside a beat.
 */
export const CAMERA_PATH: CameraKey[] = [
  { t: 0.0, position: [1.38, 0.8, 1.78], target: [0.02, 0.11, -0.05], fov: 31 },
  { t: 0.15, position: [1.55, 0.86, 1.62], target: [0, 0.2, 0], fov: 34 },
  { t: 0.3, position: [0.1, 1.78, 2.15], target: [0, 0.3, 0], fov: 36 },
  { t: 0.45, position: [2.05, 1.36, 2.05], target: [0, 0.26, 0], fov: 34 },
  { t: 0.58, position: [1.86, 1.04, 1.9], target: [0, 0.17, 0], fov: 34 },
  { t: 0.68, position: [1.95, 0.56, 1.86], target: [0, 0.1, 0], fov: 32 },
  { t: 0.75, position: [-1.76, 0.76, 1.86], target: [0, 0.13, 0], fov: 33 },
  { t: 0.85, position: [-1.62, 1.55, 2.66], target: [0, 0.5, 0], fov: 34 },
  { t: 0.93, position: [0.3, 1.75, 3.9], target: [0.05, 0.6, 0], fov: 30 },
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
  const mix = (p: [number, number, number], q: [number, number, number]): [number, number, number] => [
    p[0] + (q[0] - p[0]) * f,
    p[1] + (q[1] - p[1]) * f,
    p[2] + (q[2] - p[2]) * f,
  ];
  return { position: mix(a.position, b.position), target: mix(a.target, b.target), fov: a.fov + (b.fov - a.fov) * f };
}
