import * as THREE from 'three';
import { bevelledBox } from '../../../lib/kit/kit-core.js';
import { PARTS, nailPositions, type PalletPart } from './palletParts';
import type { SceneMaterials } from './materials';

export type PalletPhases = {
  /** Scene 02: deck boards fly in and line up in a row. */
  boards: number;
  /** Scene 03: blocks and stringers arrive, everything spreads into the exploded view. */
  components: number;
  /** Scene 04: parts converge on their rest transforms. */
  assembly: number;
};

export type PalletPartHandle = {
  part: PalletPart;
  mesh: THREE.Mesh;
};

export type PalletModel = {
  group: THREE.Group;
  parts: PalletPartHandle[];
  /** Drives the build. Pass 1/1/1 for a finished pallet (used by the spec viewer). */
  update: (phases: PalletPhases) => void;
  /** Exploded view as a pure display offset on top of the rest pose — never a second pose. */
  setExplode: (factor: number) => void;
};

const EXPLODE_SCALE = 0.34;
const STAGGER = 0.55;

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function smoothstep(x: number) {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

/** Settle with a short overshoot so a part lands like it was pressed into place, not faded in. */
function easeOutBack(x: number, overshoot = 1.24) {
  const c = clamp01(x);
  const inv = c - 1;
  return 1 + (overshoot + 1) * inv * inv * inv + overshoot * inv * inv;
}

/** Window for one part inside a staggered phase: part 0 starts at 0, the last starts at STAGGER. */
function staggered(progress: number, index: number, count: number) {
  const start = count > 1 ? (index / (count - 1)) * STAGGER : 0;
  return clamp01((progress - start) / (1 - STAGGER));
}

export function buildPallet(materials: SceneMaterials, seed = 1): PalletModel {
  const group = new THREE.Group();
  const parts: PalletPartHandle[] = [];

  const deckBoards = PARTS.filter((p) => p.align);
  const components = PARTS.filter((p) => !p.align);
  // Index inside its own phase group, resolved once instead of scanning the list every frame.
  const phaseIndex = new Map<string, number>();
  deckBoards.forEach((p, i) => phaseIndex.set(p.id, i));
  components.forEach((p, i) => phaseIndex.set(p.id, i));

  PARTS.forEach((part, index) => {
    const geometry = bevelledBox({
      width: part.size[0],
      height: part.size[1],
      depth: part.size[2],
      bevel: 0.004,
    });
    const material = materials.wood[(index * 7 + seed) % materials.wood.length];
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.partId = part.id;
    mesh.position.set(...part.rest);
    group.add(mesh);
    parts.push({ part, mesh });
  });

  // Nails: one InstancedMesh for the whole pallet — the last thing to arrive, and the cue that
  // the structure is now fastened rather than merely stacked.
  const nails = nailPositions();
  // Flat heads sitting on the board face: a nail that stands proud reads as a peg.
  const nailGeometry = new THREE.CylinderGeometry(0.0042, 0.0034, 0.003, 8);
  const nailHead = new THREE.InstancedMesh(nailGeometry, materials.nail, nails.length);
  nailHead.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  group.add(nailHead);

  const explode = { factor: 0 };

  const applyNails = (reveal: number) => {
    const shown = smoothstep(reveal);
    nailHead.visible = shown > 0.01;
    for (let i = 0; i < nails.length; i++) {
      const local = clamp01(shown * nails.length - i);
      position.set(nails[i][0], nails[i][1] + 0.001 + (1 - local) * 0.07, nails[i][2]);
      scale.setScalar(local);
      matrix.compose(position, quaternion, scale);
      nailHead.setMatrixAt(i, matrix);
    }
    nailHead.instanceMatrix.needsUpdate = true;
  };

  const update = ({ boards, components: componentsPhase, assembly }: PalletPhases) => {
    parts.forEach(({ part, mesh }) => {
      const isDeck = Boolean(part.align);
      const explodePose: [number, number, number] = [
        part.rest[0] + part.explodeDir[0] * EXPLODE_SCALE,
        part.rest[1] + part.explodeDir[1] * EXPLODE_SCALE,
        part.rest[2] + part.explodeDir[2] * EXPLODE_SCALE,
      ];

      let px: number;
      let py: number;
      let pz: number;
      let rotationBlend: number; // 1 = full spawn rotation, 0 = aligned with the pallet
      let visible = true;

      if (assembly > 0) {
        // Scene 04: exploded -> rest, in authored assembly order, landing with a small overshoot.
        const local = easeOutBack(staggered(assembly, part.order, PARTS.length));
        px = explodePose[0] + (part.rest[0] - explodePose[0]) * local;
        py = explodePose[1] + (part.rest[1] - explodePose[1]) * local;
        pz = explodePose[2] + (part.rest[2] - explodePose[2]) * local;
        rotationBlend = 0;
      } else if (componentsPhase > 0) {
        if (isDeck) {
          // Deck boards leave the row and spread into the exploded layout.
          const local = smoothstep(staggered(componentsPhase, phaseIndex.get(part.id)!, deckBoards.length));
          const from = part.align!;
          px = from[0] + (explodePose[0] - from[0]) * local;
          py = from[1] + (explodePose[1] - from[1]) * local;
          pz = from[2] + (explodePose[2] - from[2]) * local;
          rotationBlend = 0;
        } else {
          // Blocks and stringers only exist from scene 03 onward: they fly in to the exploded pose.
          const local = smoothstep(staggered(componentsPhase, phaseIndex.get(part.id)!, components.length));
          visible = local > 0.001;
          px = part.spawn[0] + (explodePose[0] - part.spawn[0]) * local;
          py = part.spawn[1] + (explodePose[1] - part.spawn[1]) * local;
          pz = part.spawn[2] + (explodePose[2] - part.spawn[2]) * local;
          rotationBlend = 1 - local;
        }
      } else if (isDeck && boards > 0) {
        // Scene 02: spawn -> the neat parallel row.
        const local = smoothstep(staggered(boards, phaseIndex.get(part.id)!, deckBoards.length));
        visible = local > 0.001;
        const to = part.align!;
        px = part.spawn[0] + (to[0] - part.spawn[0]) * local;
        py = part.spawn[1] + (to[1] - part.spawn[1]) * local;
        pz = part.spawn[2] + (to[2] - part.spawn[2]) * local;
        rotationBlend = 1 - local;
      } else {
        visible = false;
        px = part.spawn[0];
        py = part.spawn[1];
        pz = part.spawn[2];
        rotationBlend = 1;
      }

      mesh.visible = visible;
      mesh.position.set(
        px + part.explodeDir[0] * EXPLODE_SCALE * explode.factor,
        py + part.explodeDir[1] * EXPLODE_SCALE * explode.factor,
        pz + part.explodeDir[2] * EXPLODE_SCALE * explode.factor,
      );
      mesh.rotation.set(
        part.spawnRotation[0] * rotationBlend,
        part.spawnRotation[1] * rotationBlend,
        part.spawnRotation[2] * rotationBlend,
      );
    });

    // Fasteners land over the last third of the assembly phase.
    applyNails(assembly > 0 ? clamp01((assembly - 0.62) / 0.38) : 0);
  };

  update({ boards: 0, components: 0, assembly: 0 });

  return {
    group,
    parts,
    update,
    setExplode: (factor: number) => {
      explode.factor = factor;
    },
  };
}
