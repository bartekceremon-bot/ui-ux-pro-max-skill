import * as THREE from 'three';
import { create as createCottage } from '../../../lib/kit/buildings/timber-cottage.js';
import { create as createRound } from '../../../lib/kit/nature/tree-round.js';
import { create as createConifer } from '../../../lib/kit/nature/tree-conifer.js';
import { bevelledBox, materialFor, part } from '../../../lib/kit/kit-core.js';
import { lerp, smoothstep } from './shared';
import { SET_Z } from '../journeyConfig';

export type ClickTarget = {
  object: THREE.Object3D;
  title: string;
  body: string;
  toggle?: () => void;
};

export type HouseSet = {
  group: THREE.Group;
  clickTargets: ClickTarget[];
  updateConstruction: (t: number) => void;
  updateGarden: (t: number, dt: number) => void;
};

type ChildRig = {
  child: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  rotFrom: number;
  windowStart: number;
  windowEnd: number;
};

/**
 * "BUDOWA" + "GOTOWY DOM" share one physical house: the cottage kit builds it once, construction
 * staggers its own children into place across the BUDOWA beat, and the DOM beat only adds a
 * foundation apron, a garden and warmer light around the very same object.
 */
export function buildHouse(): HouseSet {
  const group = new THREE.Group();
  group.position.z = SET_Z.house;

  const dirt = new THREE.MeshStandardMaterial({ color: '#6b6a5a', roughness: 0.96 });
  // Radius kept well short of the selection set's own ground rect (which reaches z = -36 in
  // world space): the two are coplanar at y = 0, and any overlap between them z-fights.
  const lot = new THREE.Mesh(new THREE.CircleGeometry(9, 40), dirt);
  lot.rotation.x = -Math.PI / 2;
  lot.receiveShadow = true;
  group.add(lot);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(6.0, 0.35, 4.8),
    new THREE.MeshStandardMaterial({ color: '#8f8b82', roughness: 0.85 }),
  );
  foundation.position.set(0, 0.001, 0);
  foundation.scale.y = 0.001;
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  group.add(foundation);

  const cottage = createCottage({ width: 5.4, depth: 4.2, storeys: 1, seed: 3, roofPitchDeg: 40 });
  cottage.group.position.set(0, 0.35, 0);
  group.add(cottage.group);

  // Snapshot construction order before adding anything else, so the stagger below stays exact.
  const orderedChildren = cottage.group.children.slice();
  const wallsCut = Math.floor(orderedChildren.length * 0.7);
  const roofCut = Math.floor(orderedChildren.length * 0.88);
  const rigs: ChildRig[] = orderedChildren.map((child, index) => {
    const to = child.position.clone();
    let from: THREE.Vector3;
    if (index < wallsCut) {
      from = to.clone().add(new THREE.Vector3(0, -2.6, 0));
    } else if (index < roofCut) {
      from = to.clone().add(new THREE.Vector3(0, 3.4, 0));
    } else {
      from = to.clone();
    }
    const span = 1 / orderedChildren.length;
    return {
      child,
      from,
      to,
      rotFrom: index % 2 === 0 ? 0.5 : -0.5,
      windowStart: Math.max(0, index * span - span * 2),
      windowEnd: Math.min(1, index * span + span * 3),
    };
  });

  // A wireframe rafter "ghost" the roof click reveals — built with the same bevelledBox helper
  // the cottage kit itself uses, so it shares the kit's visual language.
  const ghost = new THREE.Group();
  const ghostMat = materialFor('#c9a878', { roughness: 1 });
  ghostMat.wireframe = true;
  const halfWidth = 2.7;
  const ridgeY = 2.4 + 2.1 * Math.tan((40 * Math.PI) / 180);
  for (let i = -2; i <= 2; i++) {
    const x = (i / 2) * halfWidth * 0.92;
    ghost.add(part(bevelledBox({ width: 0.1, height: 2.2, depth: 0.1, bevel: 0.01 }), ghostMat, [x, 1.6, 1.9], [Math.PI / 2 - 0.72, 0, 0]));
    ghost.add(part(bevelledBox({ width: 0.1, height: 2.2, depth: 0.1, bevel: 0.01 }), ghostMat, [x, 1.6, -1.9], [-(Math.PI / 2 - 0.72), 0, 0]));
  }
  ghost.add(part(bevelledBox({ width: 5.0, height: 0.08, depth: 0.08, bevel: 0.01 }), ghostMat, [0, ridgeY - 0.35, 0]));
  ghost.position.y = 0.35;
  ghost.visible = false;
  group.add(ghost);

  // Invisible, generously-sized hit targets: reliable to raycast regardless of the kit's own
  // internal mesh layout, and they double as the subtle hover highlight surface.
  const hitMaterial = () => new THREE.MeshBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.001, depthWrite: false });
  const wallHit = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.4, 0.3), hitMaterial());
  wallHit.position.set(0, 0.35 + 1.2, 2.25);
  group.add(wallHit);
  const roofHit = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.6, 5.2), hitMaterial());
  roofHit.position.set(0, 0.35 + ridgeY - 0.4, 0);
  group.add(roofHit);
  const beamHit = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), hitMaterial());
  beamHit.position.set(-2.55, 0.35 + 1.2, 1.6);
  group.add(beamHit);

  const clickTargets: ClickTarget[] = [
    { object: wallHit, title: 'Ściana', body: 'Rama z odsłoniętego drewna, wypełnienie i tynk — konstrukcja widoczna także z zewnątrz.' },
    { object: roofHit, title: 'Dach', body: 'Więźba krokwiowa niesie pokrycie dachowe. Kliknij ponownie, aby ukryć widok konstrukcji.', toggle: () => { ghost.visible = !ghost.visible; } },
    { object: beamHit, title: 'Słup narożny', body: 'Słup narożny — jeden z punktów, w którym więźba przenosi obciążenie na fundament.' },
  ];

  // Garden: a few young trees, scaled in around the finished house rather than modelled from
  // scratch — the same nature kit used for the forest, smaller and closer together.
  const gardenTrees: { group: THREE.Group; sway?: (dt: number, amp?: number) => boolean }[] = [];
  const gardenSpecs = [
    { x: -4.8, z: 2.6, kind: 'round' as const, seed: 71, h: 3.2 },
    { x: 4.6, z: -2.2, kind: 'conifer' as const, seed: 82, h: 3.6 },
    { x: -4.2, z: -3.0, kind: 'conifer' as const, seed: 93, h: 3.0 },
    { x: 5.2, z: 2.8, kind: 'round' as const, seed: 64, h: 2.8 },
  ];
  for (const spec of gardenSpecs) {
    const built = spec.kind === 'round' ? createRound({ seed: spec.seed, height: spec.h }) : createConifer({ seed: spec.seed, height: spec.h });
    built.group.position.set(spec.x, 0, spec.z);
    built.group.scale.setScalar(0.001);
    group.add(built.group);
    gardenTrees.push({ group: built.group, sway: built.animate as any });
  }

  return {
    group,
    clickTargets,
    updateConstruction: (t: number) => {
      const eased = smoothstep(t);
      foundation.scale.y = Math.max(0.001, smoothstep(t / 0.15));
      for (const rig of rigs) {
        const local = smoothstep((eased - rig.windowStart) / Math.max(0.001, rig.windowEnd - rig.windowStart));
        rig.child.position.lerpVectors(rig.from, rig.to, local);
        rig.child.rotation.y = rig.rotFrom * (1 - local);
        const s = lerp(0.001, 1, Math.min(1, local * 1.4));
        rig.child.scale.setScalar(s);
      }
    },
    updateGarden: (t: number, dt: number) => {
      const eased = smoothstep(t);
      dirt.color.lerp(new THREE.Color('#7a8a5e'), eased);
      gardenTrees.forEach((tree, i) => {
        const local = smoothstep((eased - i * 0.08) / 0.5);
        tree.group.scale.setScalar(Math.max(0.001, local));
        tree.sway?.(dt, 0.01);
      });
    },
  };
}
