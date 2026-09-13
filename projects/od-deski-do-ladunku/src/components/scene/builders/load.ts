import * as THREE from 'three';
import { PALLET_HEIGHT, PALLET_SIZE } from './palletParts';
import type { SceneMaterials } from './materials';

/**
 * The load: cartons plus the stretch film.
 *
 * Pattern and placement follow `recipe.pallet-load-build`: a column pattern that tiles the deck
 * exactly (full support under every carton, zero overhang), and a placement path that travels
 * above the cartons already standing before it descends — never a straight fade or a drop
 * through an occupied cell. All cartons are one InstancedMesh, so the whole load is one draw call.
 */

const BOX = { x: 0.4, y: 0.3, z: 0.4 };
const COLS = 3; // along X: 3 * 0.4 = 1.2 = deck length
const ROWS = 2; // along Z: 2 * 0.4 = 0.8 = deck width
const LAYERS = 3;
export const CARTON_COUNT = COLS * ROWS * LAYERS;
export const LOAD_HEIGHT = LAYERS * BOX.y;
export const LOAD_TOP_Y = PALLET_HEIGHT + LOAD_HEIGHT;

type Slot = {
  target: THREE.Vector3;
  yaw: number;
  scale: number;
  /** Height the carton travels at before it descends: always above everything already placed. */
  clearY: number;
};

export type LoadModel = {
  group: THREE.Group;
  /** cartons: 0..1 places the stack; film: 0..1 wraps it. */
  update: (cartons: number, film: number) => void;
};

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function smoothstep(x: number) {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

function easeOutBack(x: number, overshoot = 1.1) {
  const c = clamp01(x);
  const inv = c - 1;
  return 1 + (overshoot + 1) * inv * inv * inv + overshoot * inv * inv;
}

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = (col - (COLS - 1) / 2) * BOX.x;
        const z = (row - (ROWS - 1) / 2) * BOX.z;
        const y = PALLET_HEIGHT + BOX.y / 2 + layer * BOX.y;
        slots.push({
          target: new THREE.Vector3(x, y, z),
          // Alternate layers face the other way and carry a hair of yaw, so a stack of identical
          // instances still reads as individually placed cartons.
          yaw: (layer % 2 === 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.035,
          scale: 0.982 + rand() * 0.018,
          clearY: PALLET_HEIGHT + LOAD_HEIGHT + 0.28,
        });
      }
    }
  }
  return slots;
}

export function buildLoad(materials: SceneMaterials): LoadModel {
  const group = new THREE.Group();
  const slots = buildSlots();

  const geometry = new THREE.BoxGeometry(BOX.x - 0.012, BOX.y - 0.01, BOX.z - 0.012);
  const cartons = new THREE.InstancedMesh(geometry, materials.carton, slots.length);
  cartons.castShadow = true;
  cartons.receiveShadow = true;
  cartons.count = slots.length;
  // An InstancedMesh caches the bounding sphere it computed on its first frame — when every
  // carton is still parked at the staging point. These instances move the whole way across the
  // scene, so that stale sphere culls the entire load the moment the staging point leaves the
  // frame. One object, no measurable cost: skip the test rather than recompute it every frame.
  cartons.frustumCulled = false;
  group.add(cartons);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  // Stretch film: an open-topped shell that grows upward as the wrap climbs the load.
  const filmGeometry = new THREE.BoxGeometry(PALLET_SIZE.length + 0.04, LOAD_HEIGHT + 0.02, PALLET_SIZE.width + 0.04);
  const film = new THREE.Mesh(filmGeometry, materials.film);
  film.renderOrder = 2;
  film.visible = false;
  group.add(film);

  const SPAWN_X = 1.85;

  const update = (progress: number, filmProgress: number) => {
    const placed = clamp01(progress) * slots.length;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      // Each carton owns one unit of the progress range, so they arrive strictly one after another.
      const local = clamp01(placed - i);
      if (local <= 0) {
        scale.setScalar(0.0001);
        matrix.compose(position.set(SPAWN_X, slot.clearY, slot.target.z), quaternion, scale);
        cartons.setMatrixAt(i, matrix);
        continue;
      }

      // 0 - 0.45 travel in above the stack, 0.45 - 1 descend onto the target cell.
      const travel = smoothstep(clamp01(local / 0.45));
      const drop = easeOutBack(clamp01((local - 0.45) / 0.55));
      const x = SPAWN_X + (slot.target.x - SPAWN_X) * travel;
      const y = slot.clearY + (slot.target.y - slot.clearY) * drop;

      euler.set(0, slot.yaw, 0);
      quaternion.setFromEuler(euler);
      scale.setScalar(slot.scale);
      matrix.compose(position.set(x, y, slot.target.z), quaternion, scale);
      cartons.setMatrixAt(i, matrix);
    }
    cartons.instanceMatrix.needsUpdate = true;

    const wrap = smoothstep(filmProgress);
    film.visible = wrap > 0.01;
    if (film.visible) {
      film.scale.set(1, wrap, 1);
      // Grow from the deck upward rather than from the middle out.
      film.position.set(0, PALLET_HEIGHT + (LOAD_HEIGHT * wrap) / 2, 0);
    }
  };

  update(0, 0);

  return { group, update };
}
