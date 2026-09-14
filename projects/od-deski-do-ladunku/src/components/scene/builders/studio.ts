import * as THREE from 'three';
import { bevelledBox } from '../../../lib/kit/kit-core.js';
import type { SceneMaterials } from './materials';

export type StudioModel = {
  group: THREE.Group;
  /** The infinity-curve backdrop, exposed so an embedded product shot can drop it. */
  cyclorama: THREE.Mesh;
  /** Scene 01: raw sawn timber, cleared as the boards take over. */
  updateTimber: (present: number) => void;
  /** Keeps the contact shadow under the product as it is lifted off the ground. */
  updateGrounding: (liftHeight: number) => void;
};

/**
 * A photographic infinity curve: floor, a filleted transition, and a back wall as one continuous
 * surface. A flat plane against a gradient leaves a hard horizon line exactly where the eye looks
 * for the product's silhouette; a cove removes it, which is the whole reason product studios are
 * built this way.
 */
function cycloramaGeometry(
  width: number,
  floorDepth: number,
  coveStart: number,
  radius: number,
  wallHeight: number,
): THREE.BufferGeometry {
  // Side profile as [z, y]: floor toward the camera, a quarter-circle cove, then the back wall.
  // The cove's centre sits at (-coveStart, radius), so the arc leaves the floor tangentially at
  // (-coveStart, 0) and meets the wall tangentially at (-coveStart - radius, radius).
  const profile: Array<[number, number]> = [[floorDepth, 0], [-coveStart, 0]];
  const SEGMENTS = 16;
  for (let i = 1; i <= SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * (Math.PI / 2);
    profile.push([-coveStart - radius * Math.sin(angle), radius - radius * Math.cos(angle)]);
  }
  profile.push([-coveStart - radius, wallHeight]);

  const half = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, y0] = profile[i];
    const [z1, y1] = profile[i + 1];
    const v0 = i / (profile.length - 1);
    const v1 = (i + 1) / (profile.length - 1);
    // two triangles per profile segment, spanning the full width
    positions.push(-half, y0, z0, half, y0, z0, half, y1, z1);
    positions.push(-half, y0, z0, half, y1, z1, -half, y1, z1);
    uvs.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Soft radial darkening painted under the product: the cue that says "resting on the floor". */
function contactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.06, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, 'rgba(0,0,0,0.72)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildStudio(materials: SceneMaterials): StudioModel {
  const group = new THREE.Group();

  const cyclorama = new THREE.Mesh(cycloramaGeometry(30, 9, 2.6, 3.2, 9), materials.floor);
  cyclorama.receiveShadow = true;
  cyclorama.name = 'cyclorama';
  group.add(cyclorama);

  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: contactShadowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), shadowMaterial);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  contact.renderOrder = 1;
  group.add(contact);

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

  const updateGrounding = (liftHeight: number) => {
    // Lifted load: the contact patch spreads and fades, the way a real shadow does.
    const spread = 1 + liftHeight * 1.5;
    contact.scale.set(spread, spread, 1);
    shadowMaterial.opacity = 0.85 * Math.max(0, 1 - liftHeight * 1.8);
  };

  updateTimber(1);
  updateGrounding(0);

  return { group, cyclorama, updateTimber, updateGrounding };
}
