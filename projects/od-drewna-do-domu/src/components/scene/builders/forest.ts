import * as THREE from 'three';
import { create as createConifer } from '../../../lib/kit/nature/tree-conifer.js';
import { create as createRound } from '../../../lib/kit/nature/tree-round.js';
import { groundRect } from './shared';
import { SET_Z } from '../journeyConfig';

type Sway = (dt: number, amplitude?: number) => boolean;

export type ForestSet = {
  group: THREE.Group;
  update: (dt: number) => void;
};

/**
 * "LAS": a clearing built from the skill's tree-conifer / tree-round kits, seeded so the same
 * forest renders every run. An open aisle is left near x = [-2.5, 2.5] for the camera dolly.
 */
export function buildForest(): ForestSet {
  const group = new THREE.Group();
  group.position.z = SET_Z.forest;
  group.add(groundRect(24, 14, '#5c6a4c', 2.5));

  const sways: Sway[] = [];
  const placements: Array<{ x: number; z: number; kind: 'conifer' | 'round'; seed: number; scale: number }> = [
    { x: -6.5, z: -2, kind: 'conifer', seed: 3, scale: 1.1 },
    { x: -4.2, z: 1.5, kind: 'round', seed: 8, scale: 0.95 },
    { x: -8.5, z: 3, kind: 'conifer', seed: 11, scale: 1.3 },
    { x: 6.8, z: -1.5, kind: 'conifer', seed: 4, scale: 1.05 },
    { x: 4.6, z: 2.2, kind: 'round', seed: 14, scale: 1.0 },
    { x: 9, z: 0.5, kind: 'conifer', seed: 21, scale: 1.4 },
    { x: -3.2, z: -4.5, kind: 'conifer', seed: 33, scale: 0.85 },
    { x: 3.4, z: -4.8, kind: 'round', seed: 41, scale: 0.9 },
    { x: -9.5, z: -3.6, kind: 'round', seed: 52, scale: 1.15 },
    { x: 8.2, z: -3.8, kind: 'conifer', seed: 61, scale: 1.2 },
  ];

  for (const p of placements) {
    const built = p.kind === 'conifer' ? createConifer({ seed: p.seed, height: 5.2 * p.scale }) : createRound({ seed: p.seed, height: 4.4 * p.scale });
    built.group.position.set(p.x, 0, p.z);
    built.group.rotation.y = p.seed * 0.7;
    group.add(built.group);
    if (built.animate) sways.push(built.animate as Sway);
  }

  // A thin, low mist plane at the aisle mouth — cheap fog cue instead of a particle system.
  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 6),
    new THREE.MeshBasicMaterial({ color: '#eef1e6', transparent: true, opacity: 0.14, depthWrite: false }),
  );
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(0, 0.35, -6);
  group.add(mist);

  return {
    group,
    update: (dt: number) => {
      for (const sway of sways) sway(dt);
    },
  };
}
