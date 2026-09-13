import * as THREE from 'three';
import { create as createRound } from '../../../lib/kit/nature/tree-round.js';
import { groundRect, ringTexture, smoothstep } from './shared';
import { SET_Z } from '../journeyConfig';

export type TreeSet = {
  group: THREE.Group;
  update: (localT: number, dt: number) => void;
};

/**
 * "DREWNO": one hero tree from tree-round.js becomes the whole frame, then a cut log with a
 * painted growth-ring face rises beside it as the section reveals — no full sawmill yet, just
 * the material itself.
 */
export function buildTreeCloseup(): TreeSet {
  const group = new THREE.Group();
  group.position.z = SET_Z.tree;
  group.add(groundRect(12, 10, '#5a6b4e', 0.5));

  const hero = createRound({ seed: 7, height: 6.4, radius: 0.4, lean: 0.03 });
  hero.group.position.set(-0.6, 0, -1.2);
  group.add(hero.group);

  const logGroup = new THREE.Group();
  logGroup.position.set(2.1, 0.42, 0.6);
  logGroup.scale.setScalar(0.001);
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.92 });
  const face = new THREE.MeshStandardMaterial({ map: ringTexture(), roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 1.1, 24, 1, true), bark);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  logGroup.add(body);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), face);
  cap.rotation.y = Math.PI / 2;
  cap.position.x = 0.55;
  logGroup.add(cap);
  group.add(logGroup);

  return {
    group,
    update: (localT: number, dt: number) => {
      if (hero.animate) hero.animate(dt, 0.012);
      hero.group.rotation.y += dt * 0.03;
      const reveal = smoothstep((localT - 0.35) / 0.5);
      logGroup.scale.setScalar(Math.max(0.001, reveal));
      logGroup.rotation.y = reveal * Math.PI * 0.6;
    },
  };
}
