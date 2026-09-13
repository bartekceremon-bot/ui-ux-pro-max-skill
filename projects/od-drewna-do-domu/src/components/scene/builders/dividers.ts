import * as THREE from 'three';
import { moodState } from '../scrollStore';
import { SET_Z } from '../journeyConfig';
import { BEATS } from '../journeyConfig';

export type DividerSet = {
  group: THREE.Group;
  update: (t: number) => void;
};

const FADE_WINDOW = 0.05;

function smoothstep(edge0: number, edge1: number, x: number) {
  const c = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return c * c * (3 - 2 * c);
}

/**
 * Plain fog-coloured curtains between sets, one per beat boundary. Fixed FogExp2 alone still let
 * a set two beats ahead ghost through at distance, so these curtains fully hide whatever is next
 * — then dissolve away right on the beat boundary rather than wherever the camera happens to
 * physically cross them, so the reveal always lands exactly on the text change, forward or back.
 */
export function buildDividers(): DividerSet {
  const group = new THREE.Group();
  const boundaries = [BEATS[0].end, BEATS[1].end, BEATS[2].end, BEATS[3].end];
  const zPositions = [
    (SET_Z.forest + SET_Z.tree) / 2,
    (SET_Z.tree + SET_Z.sawmill) / 2,
    (SET_Z.sawmill + SET_Z.selection) / 2,
    (SET_Z.selection + SET_Z.house) / 2,
  ];
  const materials: THREE.MeshBasicMaterial[] = [];
  zPositions.forEach((z) => {
    const material = new THREE.MeshBasicMaterial({ color: moodState.fogHex, fog: false, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 34), material);
    mesh.position.set(0, 10, z);
    group.add(mesh);
    materials.push(material);
  });

  return {
    group,
    update: (t: number) => {
      materials.forEach((material, i) => {
        const boundary = boundaries[i];
        material.color.setHex(moodState.fogHex);
        material.opacity = 1 - smoothstep(boundary - FADE_WINDOW, boundary, t);
      });
    },
  };
}
