/**
 * Vector stand-in for the WebGL journey.
 *
 * Phones never download three.js, but they should still see the product being built rather than
 * a coloured gradient. Every beat is drawn from the same box list the 3D scene works from -- deck
 * boards, blocks, stringers, cartons, film, forks -- projected isometrically and painted back to
 * front. Same geometry language, a few hundred bytes of SVG.
 */

type Tone = 'wood' | 'woodMid' | 'woodDark' | 'carton' | 'film' | 'steel';

type Box = {
  /** min corner, in decimetres, matching the real pallet: a EUR-ish deck is 12 x 8 */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tone: Tone;
};

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

/** Top / front / right, so every solid reads as lit from the upper left. */
const TONES: Record<Tone, [string, string, string]> = {
  wood: ['#d8ab74', '#b8834a', '#8f6537'],
  woodMid: ['#c79a68', '#a4733e', '#7d5730'],
  woodDark: ['#a87f4f', '#8a6234', '#664827'],
  carton: ['#c3a074', '#9d7448', '#7a5a38'],
  film: ['#cdd4d8', '#aeb7bd', '#8e979d'],
  steel: ['#5b6169', '#41464c', '#2f3338'],
};

const OPACITY: Partial<Record<Tone, number>> = { film: 0.42 };

function project(x: number, y: number, z: number): [number, number] {
  return [(x - z) * COS, (x + z) * SIN - y];
}

function facePath(points: Array<[number, number, number]>): string {
  return (
    points
      .map(([x, y, z], i) => {
        const [px, py] = project(x, y, z);
        return `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`;
      })
      .join('') + 'Z'
  );
}

function boxFaces(box: Box): Array<{ d: string; fill: string; opacity?: number }> {
  const { x, y, z, w, h, d, tone } = box;
  const [top, front, right] = TONES[tone];
  const opacity = OPACITY[tone];
  return [
    {
      d: facePath([
        [x, y + h, z],
        [x + w, y + h, z],
        [x + w, y + h, z + d],
        [x, y + h, z + d],
      ]),
      fill: top,
      opacity,
    },
    {
      d: facePath([
        [x, y, z + d],
        [x + w, y, z + d],
        [x + w, y + h, z + d],
        [x, y + h, z + d],
      ]),
      fill: front,
      opacity,
    },
    {
      d: facePath([
        [x + w, y, z + d],
        [x + w, y, z],
        [x + w, y + h, z],
        [x + w, y + h, z + d],
      ]),
      fill: right,
      opacity,
    },
  ];
}

/* --- the pallet, part for part ---------------------------------------------------------------- */
const DECK_L = 12;
const DECK_W = 8;
const BOARD_T = 0.24;
const BLOCK = 1.5;
const BLOCK_H = 0.8;
const RUN_Z = [0, (DECK_W - BLOCK) / 2, DECK_W - BLOCK];
const RUN_X = [0, (DECK_L - BLOCK) / 2, DECK_L - BLOCK];
const DECK_X = [0, 2.62, 5.25, 7.87, 10.5];
const TOP_Y = BOARD_T * 2 + BLOCK_H;

const bottomBoards = (lift = 0): Box[] =>
  RUN_Z.map((z) => ({ x: 0, y: lift, z, w: DECK_L, h: BOARD_T, d: BLOCK, tone: 'woodMid' as Tone }));

const blocks = (lift = 0): Box[] =>
  RUN_X.flatMap((x) =>
    RUN_Z.map((z) => ({ x, y: BOARD_T + lift, z, w: BLOCK, h: BLOCK_H, d: BLOCK, tone: 'woodDark' as Tone })),
  );

const stringers = (lift = 0): Box[] =>
  RUN_Z.map((z) => ({
    x: 0,
    y: BOARD_T + BLOCK_H + lift,
    z,
    w: DECK_L,
    h: BOARD_T,
    d: BLOCK,
    tone: 'woodMid' as Tone,
  }));

const deckBoards = (lift: (i: number) => number = () => 0): Box[] =>
  DECK_X.map((x, i) => ({
    x,
    y: TOP_Y + lift(i),
    z: 0,
    w: 1.5,
    h: BOARD_T,
    d: DECK_W,
    tone: 'wood' as Tone,
  }));

const cartons = (layers: number): Box[] => {
  const out: Box[] = [];
  for (let layer = 0; layer < layers; layer++) {
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 2; row++) {
        out.push({
          x: col * 4 + 0.12,
          y: TOP_Y + BOARD_T + layer * 3,
          z: row * 4 + 0.12,
          w: 3.76,
          h: 2.86,
          d: 3.76,
          tone: 'carton',
        });
      }
    }
  }
  return out;
};

/* --- the seven beats ---------------------------------------------------------------------------- */
const SCENES: Record<string, Box[]> = {
  // raw timber, still in the yard
  drewno: [
    { x: -1, y: 0, z: 0, w: 15, h: 1.5, d: 1.5, tone: 'woodDark' },
    { x: -1, y: 0, z: 2, w: 15, h: 1.5, d: 1.5, tone: 'woodMid' },
    { x: -1, y: 0, z: 4, w: 15, h: 1.5, d: 1.5, tone: 'woodDark' },
    { x: -0.6, y: 1.5, z: 1, w: 14, h: 1.5, d: 1.5, tone: 'wood' },
    { x: -0.6, y: 1.5, z: 3, w: 14, h: 1.5, d: 1.5, tone: 'woodMid' },
    { x: -0.2, y: 3, z: 2, w: 13, h: 1.5, d: 1.5, tone: 'wood' },
  ],
  // cut to length, laid out
  deski: [
    { x: 0, y: 0, z: 0, w: 12, h: 0.3, d: 1.5, tone: 'wood' },
    { x: 0, y: 0, z: 2.4, w: 12, h: 0.3, d: 1.5, tone: 'woodMid' },
    { x: 0, y: 0, z: 4.8, w: 12, h: 0.3, d: 1.5, tone: 'wood' },
    { x: 0, y: 0, z: 7.2, w: 12, h: 0.3, d: 1.5, tone: 'woodMid' },
    { x: 0, y: 0.3, z: 1.2, w: 11, h: 0.3, d: 1.5, tone: 'woodDark' },
    { x: 0, y: 0.3, z: 6, w: 11, h: 0.3, d: 1.5, tone: 'woodDark' },
  ],
  // the part inventory: boards on one side, blocks on the other
  elementy: [
    ...DECK_X.map((x, i) => ({ x, y: i % 2, z: 0, w: 1.5, h: 0.26, d: 8, tone: 'wood' as Tone })),
    ...RUN_X.flatMap((x) =>
      RUN_Z.map((z) => ({ x: x + 0.4, y: 0, z: z + 10, w: BLOCK, h: BLOCK_H, d: BLOCK, tone: 'woodDark' as Tone })),
    ),
    ...RUN_Z.map((z) => ({ x: 0, y: 0, z: z + 10, w: DECK_L, h: 0.26, d: BLOCK, tone: 'woodMid' as Tone })),
  ],
  // mid-assembly: base nailed, deck still descending
  montaz: [
    ...bottomBoards(),
    ...blocks(),
    ...stringers(),
    ...deckBoards((i) => [0, 1.6, 3.4, 5.4, 7.6][i]),
  ],
  // A close read of the joint: two deck boards over a stringer and its block.
  detal: [
    { x: 0, y: 0, z: 0, w: DECK_L, h: BOARD_T, d: BLOCK, tone: 'woodMid' },
    { x: 2, y: BOARD_T, z: 0, w: BLOCK, h: BLOCK_H, d: BLOCK, tone: 'woodDark' },
    { x: 8.5, y: BOARD_T, z: 0, w: BLOCK, h: BLOCK_H, d: BLOCK, tone: 'woodDark' },
    { x: 0, y: BOARD_T + BLOCK_H, z: 0, w: DECK_L, h: BOARD_T, d: BLOCK, tone: 'woodMid' },
    { x: 0.5, y: TOP_Y, z: -2.2, w: 1.6, h: BOARD_T, d: 5, tone: 'wood' },
    { x: 4, y: TOP_Y, z: -2.2, w: 1.6, h: BOARD_T, d: 5, tone: 'wood' },
    { x: 7.5, y: TOP_Y, z: -2.2, w: 1.6, h: BOARD_T, d: 5, tone: 'wood' },
  ],
  // The deck pattern on its own: the geometry shot, without the structure under it.
  geometria: [...bottomBoards(), ...deckBoards()],
  paleta: [...bottomBoards(), ...blocks(), ...stringers(), ...deckBoards()],
  towar: [...bottomBoards(), ...blocks(), ...stringers(), ...deckBoards(), ...cartons(2)],
  ladunek: [
    { x: 0.8, y: BOARD_T - 0.1, z: 1.2, w: 13.5, h: 0.36, d: 1, tone: 'steel' },
    { x: 0.8, y: BOARD_T - 0.1, z: 5.6, w: 13.5, h: 0.36, d: 1, tone: 'steel' },
    ...bottomBoards(),
    ...blocks(),
    ...stringers(),
    ...deckBoards(),
    ...cartons(3),
    { x: -0.2, y: TOP_Y + BOARD_T, z: -0.2, w: 12.4, h: 9.2, d: 8.4, tone: 'film' },
  ],
};

// The closing frame is the same subject as the load beat, held one shot longer.
SCENES.transport = SCENES.ladunek;

/** Painter's algorithm: far boxes first, so nothing needs a z-buffer. */
function depth(box: Box): number {
  return box.x + box.z + box.y * 0.9;
}

export function IsoArt({ beat }: { beat: string }): JSX.Element | null {
  const boxes = SCENES[beat];
  if (!boxes) return null;

  const sorted = [...boxes].sort((a, b) => depth(a) - depth(b));
  const faces = sorted.flatMap(boxFaces);

  // Fit the viewBox to the drawing so every beat reads at the same visual weight.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    for (const corner of [
      [box.x, box.y, box.z],
      [box.x + box.w, box.y, box.z],
      [box.x, box.y, box.z + box.d],
      [box.x + box.w, box.y, box.z + box.d],
      [box.x, box.y + box.h, box.z],
      [box.x + box.w, box.y + box.h, box.z],
      [box.x, box.y + box.h, box.z + box.d],
      [box.x + box.w, box.y + box.h, box.z + box.d],
    ] as Array<[number, number, number]>) {
      const [px, py] = project(...corner);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }
  const pad = 0.8;

  return (
    <svg
      className="isoArt"
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g>
        {faces.map((face, i) => (
          <path key={i} d={face.d} fill={face.fill} fillOpacity={face.opacity ?? 1} />
        ))}
      </g>
    </svg>
  );
}
