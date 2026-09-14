/**
 * Authored part list for a block pallet, 1200 x 800 mm.
 *
 * Everything downstream (assembly order, exploded view, the clickable spec model) reads this
 * one table, so a part exists exactly once: `flat-pack-assembly-sequence` treats the part
 * inventory as the authority for the sequence, and `portable-speaker-exploded` requires the
 * exploded pose to be a display offset on top of the rest pose, never a second set of
 * coordinates. Both rules are why `rest` and `explodeDir` live here side by side.
 */

export type PartKind = 'bottom' | 'block' | 'stringer' | 'top';

export type PalletPart = {
  id: string;
  kind: PartKind;
  label: string;
  /** [x, y, z] box size in metres. */
  size: [number, number, number];
  /** Final assembled centre position. */
  rest: [number, number, number];
  /** Unit-ish direction the part travels in an exploded view. */
  explodeDir: [number, number, number];
  /** Slot in the neat parallel row shown before assembly (boards only; others reuse rest). */
  align?: [number, number, number];
  /** Where the part flies in from. */
  spawn: [number, number, number];
  spawnRotation: [number, number, number];
  /** Position in the assembly sequence, 0 first. */
  order: number;
  spec: { wymiar: string; material: string; info: string };
};

const L = 1.2; // pallet length (X)
const W = 0.8; // pallet width (Z)
const BOARD_T = 0.022;
const BLOCK = 0.145;
const BLOCK_H = 0.078;

const Y_BOTTOM = BOARD_T / 2; // 0.011
const Y_BLOCK = BOARD_T + BLOCK_H / 2; // 0.061
const Y_STRINGER = BOARD_T + BLOCK_H + BOARD_T / 2; // 0.111
const Y_TOP = BOARD_T + BLOCK_H + BOARD_T + BOARD_T / 2; // 0.133

export const PALLET_HEIGHT = BOARD_T + BLOCK_H + BOARD_T + BOARD_T;
export const PALLET_SIZE = { length: L, width: W, height: PALLET_HEIGHT };
/** Clear height of the fork pocket between the bottom deck and the stringers. */
export const FORK_POCKET_Y = BOARD_T + BLOCK_H / 2;

const BLOCK_X = [-0.5275, 0, 0.5275];
const BLOCK_Z = [-0.3275, 0, 0.3275];

const TOP_BOARDS: Array<{ z: number; width: number }> = [
  { z: -0.3275, width: 0.145 },
  { z: -0.1725, width: 0.1 },
  { z: 0, width: 0.145 },
  { z: 0.1725, width: 0.1 },
  { z: 0.3275, width: 0.145 },
];

const BOTTOM_BOARDS: Array<{ z: number; width: number }> = [
  { z: -0.35, width: 0.1 },
  { z: 0, width: 0.145 },
  { z: 0.35, width: 0.1 },
];

/** The eight deck boards line up in one evenly spaced floating row during scene 02. */
const ROW_SPACING = 0.19;

export const PARTS: PalletPart[] = [];

let order = 0;

// --- bottom deck: laid first, so the sequence starts at the ground ---------------------------
BOTTOM_BOARDS.forEach((board, i) => {
  PARTS.push({
    id: `bottom-${i + 1}`,
    kind: 'bottom',
    label: 'Deska dolna',
    size: [L, BOARD_T, board.width],
    rest: [0, Y_BOTTOM, board.z],
    explodeDir: [0, -1.15, board.z === 0 ? 0 : Math.sign(board.z) * 0.55],
    spawn: [-2.4, -0.35, board.z * 1.6],
    spawnRotation: [0, 0.5, -0.35],
    order: order++,
    spec: {
      wymiar: '[DŁUGOŚĆ] × [SZEROKOŚĆ] × [GRUBOŚĆ] mm',
      material: '[GATUNEK DREWNA]',
      info: 'Dolna warstwa nośna — rozkłada nacisk na podłoże i na widły wózka.',
    },
  });
});

// --- blocks -----------------------------------------------------------------------------------
BLOCK_X.forEach((x, xi) => {
  BLOCK_Z.forEach((z, zi) => {
    PARTS.push({
      id: `block-${xi + 1}-${zi + 1}`,
      kind: 'block',
      label: 'Klocek',
      size: [BLOCK, BLOCK_H, BLOCK],
      rest: [x, Y_BLOCK, z],
      explodeDir: [Math.sign(x) * 0.1, -0.35, Math.sign(z) * 0.1],
      spawn: [x * 2.6, 1.5 + zi * 0.2, z * 2.6 - 1.4],
      spawnRotation: [0.4, 0.8, 0.2],
      order: order++,
      spec: {
        wymiar: '[BOK] × [BOK] × [WYSOKOŚĆ] mm',
        material: '[MATERIAŁ KLOCKA]',
        info: 'Dystans między pokładami. Tworzy kieszenie na widły z czterech stron.',
      },
    });
  });
});

// --- stringers (the load-bearing boards over the blocks) ---------------------------------------
BLOCK_X.forEach((x, i) => {
  PARTS.push({
    id: `stringer-${i + 1}`,
    kind: 'stringer',
    label: 'Wspornik nośny',
    size: [BLOCK, BOARD_T, W],
    rest: [x, Y_STRINGER, 0],
    explodeDir: [0, 0.95, 0],
    spawn: [x * 2.2, 1.9, 1.8],
    spawnRotation: [0.25, -0.6, 0.15],
    order: order++,
    spec: {
      wymiar: '[DŁUGOŚĆ] × [SZEROKOŚĆ] × [GRUBOŚĆ] mm',
      material: '[GATUNEK DREWNA]',
      info: 'Spina rząd klocków i przenosi obciążenie pokładu górnego na dolny.',
    },
  });
});

// --- top deck ----------------------------------------------------------------------------------
TOP_BOARDS.forEach((board, i) => {
  PARTS.push({
    id: `top-${i + 1}`,
    kind: 'top',
    label: 'Deska górna',
    size: [L, BOARD_T, board.width],
    rest: [0, Y_TOP, board.z],
    explodeDir: [0, 1.35 + i * 0.07, board.z * 1.7],
    spawn: [2.6, 1.2 + i * 0.16, board.z * 2.2],
    spawnRotation: [-0.2, -0.45, 0.3],
    order: order++,
    spec: {
      wymiar: '[DŁUGOŚĆ] × [SZEROKOŚĆ] × [GRUBOŚĆ] mm',
      material: '[GATUNEK DREWNA]',
      info: 'Pokład nośny — bezpośrednio pod ładunkiem, przenosi obciążenie na wsporniki.',
    },
  });
});

/** Scene 02 lines the eight deck boards up in one row; blocks and stringers stay off-stage. */
const deckBoards = PARTS.filter((p) => p.kind === 'top' || p.kind === 'bottom');
deckBoards.forEach((part, i) => {
  part.align = [0, 0.32, (i - (deckBoards.length - 1) / 2) * ROW_SPACING];
});

export const ASSEMBLY_COUNT = PARTS.length;

/** Nail positions: every top board over every stringer, every bottom board over every block. */
export function nailPositions(): Array<[number, number, number]> {
  const nails: Array<[number, number, number]> = [];
  for (const board of TOP_BOARDS) {
    for (const x of BLOCK_X) {
      nails.push([x - 0.035, Y_TOP + BOARD_T / 2, board.z]);
      nails.push([x + 0.035, Y_TOP + BOARD_T / 2, board.z]);
    }
  }
  for (const board of BOTTOM_BOARDS) {
    for (const x of BLOCK_X) {
      nails.push([x, Y_BOTTOM - BOARD_T / 2, board.z]);
    }
  }
  return nails;
}
