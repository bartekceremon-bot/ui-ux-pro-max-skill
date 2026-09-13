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

  // Operator deck, seat and steering column. Three small solids, but without them the machine
  // reads as a stack of grey boxes rather than as something a person drives.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.56), materials.steelDark);
  cab.position.set(1.52, 0.69, 0);
  cab.castShadow = true;
  group.add(cab);

  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.34), materials.steelDark);
  seatBase.position.set(1.62, 0.79, 0);
  seatBase.castShadow = true;
  group.add(seatBase);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.34), materials.steelDark);
  seatBack.position.set(1.74, 0.94, 0);
  seatBack.castShadow = true;
  group.add(seatBack);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), materials.steel);
  column.position.set(1.32, 0.86, 0);
  column.rotation.z = 0.28;
  group.add(column);

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 16), materials.steelDark);
  wheelRim.position.set(1.28, 1.0, 0);
  wheelRim.rotation.set(Math.PI / 2, 0, 0.28);
  group.add(wheelRim);

  // Overhead guard: the frame over the driver is what makes a boxy shape read as a forklift.
  const guardPost = new THREE.BoxGeometry(0.06, 0.82, 0.06);
  for (const x of [1.16, 1.84]) {
    for (const z of [-0.3, 0.3]) {
      const post = new THREE.Mesh(guardPost, materials.steelDark);
      post.position.set(x, 0.98, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  const guardRoof = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.72), materials.steelDark);
  guardRoof.position.set(1.5, 1.41, 0);
  guardRoof.castShadow = true;
  group.add(guardRoof);

  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10), materials.steelDark);
  beaconBase.position.set(1.5, 1.445, 0);
  group.add(beaconBase);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8), materials.beacon);
  beacon.position.set(1.5, 1.47, 0);
  beacon.scale.y = 0.85;
  group.add(beacon);

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
