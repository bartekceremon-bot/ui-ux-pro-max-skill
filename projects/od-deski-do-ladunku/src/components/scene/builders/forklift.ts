import * as THREE from 'three';
import { FORK_POCKET_Y } from './palletParts';
import type { SceneMaterials } from './materials';

export type ForkliftModel = {
  group: THREE.Group;
  /**
   * approach 0..1 slides the forks into the pockets; lift 0..1 raises the carriage.
   * Returns the eased carriage height in metres — the pallet has to ride up by exactly that,
   * so the caller reads it back instead of easing the same input a second time.
   */
  update: (approach: number, lift: number) => number;
};

export const LIFT_HEIGHT = 0.34;

const FORK_LENGTH = 1.15;
const FORK_THICKNESS = 0.038;
const APPROACH_FROM = 3.4;

function smoothstep(x: number) {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/**
 * A stand-in truck, not a modelled machine: mast, carriage, two forks, counterweight and wheels.
 * What has to be right is the geometry that touches the product — the forks are the thickness of
 * the pallet's fork pocket and enter at its centre height, so the lift looks like it would work.
 */
export function buildForklift(materials: SceneMaterials): ForkliftModel {
  const group = new THREE.Group();

  // Everything that rises with the load sits in the carriage group.
  const carriage = new THREE.Group();
  group.add(carriage);

  const forkGeometry = new THREE.BoxGeometry(FORK_LENGTH, FORK_THICKNESS, 0.11);
  for (const z of [-0.26, 0.26]) {
    const fork = new THREE.Mesh(forkGeometry, materials.steel);
    // Tip reaches past the far row of blocks; the heel stays clear of the pallet edge.
    fork.position.set(0.12, FORK_POCKET_Y, z);
    fork.castShadow = true;
    carriage.add(fork);
  }

  const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.72), materials.steelDark);
  backPlate.position.set(0.72, FORK_POCKET_Y + 0.24, 0);
  backPlate.castShadow = true;
  carriage.add(backPlate);

  // Mast rails stay put while the carriage travels up them.
  const railGeometry = new THREE.BoxGeometry(0.07, 1.5, 0.07);
  for (const z of [-0.3, 0.3]) {
    const rail = new THREE.Mesh(railGeometry, materials.steelDark);
    rail.position.set(0.83, 0.75, z);
    rail.castShadow = true;
    group.add(rail);
  }

  // Mast crossbar, so the two rails read as one frame rather than two loose posts.
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.72), materials.steelDark);
  crossbar.position.set(0.83, 1.44, 0);
  group.add(crossbar);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.7), materials.steelDark);
  body.position.set(1.42, 0.4, 0);
  body.castShadow = true;
  group.add(body);

  // Counterweight at the back: the mass that makes the machine read as a counterbalance truck.
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.66), materials.steelDark);
  counterweight.position.set(1.92, 0.36, 0);
  counterweight.castShadow = true;
  group.add(counterweight);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.56), materials.steelDark);
  cab.position.set(1.5, 0.8, 0);
  cab.castShadow = true;
  group.add(cab);

  const wheelGeometry = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 18);
  wheelGeometry.rotateX(Math.PI / 2);
  for (const x of [1.14, 1.86]) {
    for (const z of [-0.31, 0.31]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.steelDark);
      wheel.position.set(x, 0.14, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  group.visible = false;

  const update = (approach: number, lift: number) => {
    const inbound = smoothstep(approach);
    group.visible = inbound > 0.001;
    group.position.x = APPROACH_FROM * (1 - inbound);
    const height = smoothstep(lift) * LIFT_HEIGHT;
    carriage.position.y = height;
    return height;
  };

  update(0, 0);

  return { group, update };
}
