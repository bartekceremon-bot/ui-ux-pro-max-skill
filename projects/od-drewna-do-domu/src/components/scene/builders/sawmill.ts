import * as THREE from 'three';
import { groundRect, lerp, smoothstep } from './shared';
import { SET_Z } from '../journeyConfig';

export type SawmillSet = {
  group: THREE.Group;
  update: (localT: number, dt: number) => void;
};

const PLANK_COUNT = 6;

/**
 * "PRZECIERANIE": a stylised trak, not an industrial simulation. A log rides a carriage through
 * a fixed blade plane; each time it crosses a threshold a plank peels off and stacks to the side.
 */
export function buildSawmill(): SawmillSet {
  const group = new THREE.Group();
  group.position.z = SET_Z.sawmill;
  group.add(groundRect(13, 8, '#6b6255', 0, 0.98));

  const steel = new THREE.MeshStandardMaterial({ color: '#2c2b28', roughness: 0.55, metalness: 0.4 });
  const timber = new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.7 });
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.92 });
  const plankMat = new THREE.MeshStandardMaterial({ color: '#cba36c', roughness: 0.55 });

  // Base frame and two rails the carriage rides on.
  const base = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.18, 2.4), steel);
  base.position.set(0, 0.09, 0);
  base.receiveShadow = true;
  group.add(base);
  for (const rz of [-0.7, 0.7]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.06, 0.12), steel);
    rail.position.set(0, 0.21, rz);
    group.add(rail);
  }

  const BLADE_X = 0.6;
  const bladeFrame = new THREE.Group();
  const post = (x: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), steel);
    p.position.set(BLADE_X + x, 1.2, 0);
    p.castShadow = true;
    return p;
  };
  bladeFrame.add(post(-1.1), post(1.1));
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), steel);
  beam.position.set(BLADE_X, 2.3, 0);
  bladeFrame.add(beam);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 1.3), new THREE.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.3, metalness: 0.8 }));
  blade.position.set(BLADE_X, 1.15, 0);
  bladeFrame.add(blade);
  group.add(bladeFrame);

  // Carriage + log.
  const carriage = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.6), steel);
  bed.position.y = 0.32;
  carriage.add(bed);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 3.6, 20), bark);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.85;
  log.castShadow = true;
  carriage.add(log);
  group.add(carriage);

  const START_X = -3.4;
  const END_X = 3.6;

  // Planks that stack up once the carriage has passed the blade.
  const planks: THREE.Mesh[] = [];
  const plankTargets: THREE.Vector3[] = [];
  for (let i = 0; i < PLANK_COUNT; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.42), plankMat);
    plank.castShadow = true;
    plank.receiveShadow = true;
    const target = new THREE.Vector3(3.9, 0.12 + i * 0.1, -1.0);
    plank.position.set(target.x, target.y + 1.4, target.z);
    plank.visible = false;
    planks.push(plank);
    plankTargets.push(target);
    group.add(plank);
  }

  // Sawdust: a cheap point sprite cloud near the blade, own material so opacity is safe to animate.
  const dustCount = 90;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = BLADE_X + (Math.random() - 0.5) * 0.5;
    dustPositions[i * 3 + 1] = 0.3 + Math.random() * 1.1;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 1.3;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = new THREE.PointsMaterial({ color: '#e9d9b8', size: 0.045, transparent: true, opacity: 0 });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  group.add(dust);

  let clock = 0;
  let lastRevealed = -1;

  return {
    group,
    update: (localT: number, dt: number) => {
      clock += dt;
      const cutProgress = smoothstep((localT - 0.06) / 0.82);
      carriage.position.x = lerp(START_X, END_X, cutProgress);
      const cutting = cutProgress > 0.03 && cutProgress < 0.97;
      blade.position.y = 1.15 + (cutting ? Math.sin(clock * 40) * 0.015 : 0);
      dustMaterial.opacity = cutting ? 0.55 : 0;
      dust.rotation.y += dt * 0.4;

      const revealCount = Math.floor(cutProgress * PLANK_COUNT);
      if (revealCount !== lastRevealed) {
        lastRevealed = revealCount;
      }
      for (let i = 0; i < PLANK_COUNT; i++) {
        const plank = planks[i];
        const t = smoothstep((cutProgress * PLANK_COUNT - i) / 0.6);
        if (t > 0) plank.visible = true;
        const target = plankTargets[i];
        plank.position.set(target.x, lerp(target.y + 1.4, target.y, t), target.z);
      }
    },
  };
}
