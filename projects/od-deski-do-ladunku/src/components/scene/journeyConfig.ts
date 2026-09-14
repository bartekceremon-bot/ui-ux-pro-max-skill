export type Beat = {
  id: string;
  start: number;
  end: number;
  kicker: string;
  line: string;
  /** Small chips shown next to the line, e.g. part names in the components scene. */
  chips?: string[];
  /** The closing frame carries the offer, so the story ends on an action rather than a picture. */
  cta?: boolean;
};

/**
 * The scroll timeline, kept in one table so copy and 3D can never drift apart.
 *
 * Eight shots, matching the brief's camera narration: the exploded pallet, the assembly, a close
 * detail of the timber and the joint, the deck read from above, the finished pallet, the load
 * going on, the wrapped load leaving, and the closing frame that carries the offer. Each beat
 * owns one camera move and one idea; nothing changes direction inside a beat.
 */
export const BEATS: Beat[] = [
  {
    id: 'elementy',
    start: 0,
    end: 0.14,
    kicker: '01 — Elementy',
    line: 'Każdy element ma swoją funkcję.',
    chips: ['Deski górne', 'Wsporniki nośne', 'Klocki', 'Deski dolne'],
  },
  { id: 'montaz', start: 0.14, end: 0.34, kicker: '02 — Montaż', line: 'Paleta powstaje element po elemencie.' },
  {
    id: 'detal',
    start: 0.34,
    end: 0.46,
    kicker: '03 — Detal',
    line: 'Drewno, połączenie, gwóźdź.',
    chips: ['Struktura drewna', 'Zbijanie', 'Kontrola połączeń'],
  },
  { id: 'geometria', start: 0.46, end: 0.55, kicker: '04 — Geometria', line: 'Układ pokładu widziany z góry.' },
  {
    id: 'paleta',
    start: 0.55,
    end: 0.66,
    kicker: '05 — Gotowa paleta',
    line: 'Gotowa do pracy.',
    chips: ['Wymiary [WYMIAR]', 'Nośność [NOŚNOŚĆ]', 'Waga [WAGA]'],
  },
  {
    id: 'towar',
    start: 0.66,
    end: 0.8,
    kicker: '06 — Towar',
    line: 'Ładunek układany warstwa po warstwie.',
    chips: ['Układ kolumnowy', 'Pełne podparcie', 'Bez nawisu'],
  },
  { id: 'ladunek', start: 0.8, end: 0.92, kicker: '07 — Ładunek', line: 'Folia, widły, transport.' },
  {
    id: 'transport',
    start: 0.92,
    end: 1.0001,
    kicker: '08 — Gotowe',
    line: 'Paleta gotowa do drogi.',
    cta: true,
  },
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
    assembly: span(t, 0.14, 0.36),
    cartons: span(t, 0.66, 0.81),
    film: span(t, 0.8, 0.865),
    approach: span(t, 0.845, 0.925),
    lift: span(t, 0.925, 0.985),
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
  // 01 exploded — the pallet stands well back, panned right so the headline has clean space
  { t: 0.0, position: [2.85, 1.78, 3.55], target: [0, 0.3, 0], fov: 25, shift: -0.45 },
  { t: 0.14, position: [2.5, 1.5, 3.1], target: [0, 0.22, 0], fov: 27, shift: -0.2 },
  // 02 assembly — closing in as the parts land
  { t: 0.26, position: [2.15, 1.24, 2.45], target: [0, 0.16, 0], fov: 29 },
  { t: 0.36, position: [1.5, 0.52, 1.58], target: [0, 0.11, 0], fov: 30 },
  // 03 detail — inside the deck: grain, the joint, the nail heads
  { t: 0.44, position: [0.46, 0.29, 0.52], target: [0.02, 0.12, 0.0], fov: 34 },
  // 04 geometry — nearly overhead, so the deck pattern reads as a drawing
  { t: 0.52, position: [0.36, 2.45, 0.62], target: [0, 0.09, 0], fov: 32 },
  // 05 the finished pallet, held for a beat
  { t: 0.6, position: [1.5, 0.6, 1.62], target: [0, 0.1, 0], fov: 30 },
  // 06 the load goes on
  { t: 0.72, position: [-1.72, 0.92, 1.92], target: [0, 0.22, 0], fov: 33 },
  { t: 0.84, position: [-1.6, 1.5, 2.62], target: [0, 0.46, 0], fov: 34 },
  // 07 wrapped and lifted
  { t: 0.93, position: [0.3, 1.72, 3.85], target: [0.05, 0.56, 0], fov: 30 },
  // 08 closing frame — subject right, room on the left for the offer
  { t: 1.0, position: [2.45, 2.0, 5.2], target: [0.5, 0.62, 0], fov: 27, shift: -0.3 },
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
