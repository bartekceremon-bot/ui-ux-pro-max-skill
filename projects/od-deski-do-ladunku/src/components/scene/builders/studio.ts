import * as THREE from 'three';
import { bevelledBox } from '../../../lib/kit/kit-core.js';
import type { SceneMaterials } from './materials';

export type StudioModel = {
  group: THREE.Group;
  /** Scene 01: raw sawn timber, cleared as the boards take over. */
  updateTimber: (present: number) => void;
};

/**
 * The set: one concrete floor and three rough beams for the opening shot. Everything else in
 * the scene is the product, which is the point of a studio — nothing competes with the subject.
 */
export function buildStudio(materials: SceneMaterials): StudioModel {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.receiveShadow = true;
  group.add(floor);

  // Raw timber for the opening close-up. kit-core's bevelledBox extrudes along Z, and
  // ExtrudeGeometry groups its caps as material 0 and its walls as material 1 — so a beam built
  // "long in Z" and then turned a quarter turn gets the end-grain map exactly on its two cut
  // ends, which is what makes the first shot read as sawn timber rather than a brown block.
  const timber = new THREE.Group();
  const beams: THREE.Mesh[] = [];
  const layout: Array<{ pos: [number, number, number]; rot: number; len: number }> = [
    { pos: [0.05, 0.065, 0.02], rot: 0.04, len: 1.5 },
    { pos: [-0.12, 0.065, 0.29], rot: -0.11, len: 1.34 },
    { pos: [0.16, 0.195, 0.15], rot: 0.07, len: 1.42 },
    { pos: [-0.3, 0.065, -0.26], rot: 0.16, len: 1.2 },
  ];
  layout.forEach((entry) => {
    const geometry = bevelledBox({ width: 0.13, height: 0.13, depth: entry.len, bevel: 0.006 });
    const mesh = new THREE.Mesh(geometry, [materials.endGrain, materials.rawTimber]);
    mesh.position.set(...entry.pos);
    mesh.rotation.y = Math.PI / 2 + entry.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    timber.add(mesh);
    beams.push(mesh);
  });
  group.add(timber);

  const updateTimber = (present: number) => {
    const shown = Math.min(1, Math.max(0, present));
    timber.visible = shown > 0.01;
    beams.forEach((beam, i) => {
      const local = Math.min(1, Math.max(0, shown * 1.6 - i * 0.12));
      beam.scale.setScalar(Math.max(0.0001, local));
      beam.position.y = layout[i].pos[1] - (1 - local) * 0.08;
    });
  };

  updateTimber(1);

  return { group, updateTimber };
}
