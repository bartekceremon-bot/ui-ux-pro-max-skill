import * as THREE from 'three';
import { groundRect } from './shared';
import { SET_Z } from '../journeyConfig';
import type { Hoverable } from './shared';

export type SelectionSet = {
  group: THREE.Group;
  hoverables: Hoverable[];
};

const WOOD = () => new THREE.MeshStandardMaterial({ color: '#a9825a', roughness: 0.68 });

/**
 * "SELEKCJA / OBRÓBKA": sorted structural members laid out for inspection. Each mesh carries
 * its own material instance (not the shared kit-core cache) precisely so hover highlighting can
 * mutate emissive without touching any other object in the scene.
 */
export function buildSelection(): SelectionSet {
  const group = new THREE.Group();
  group.position.z = SET_Z.selection;
  group.add(groundRect(11, 8, '#8f8574', 0, 0.96));

  const hoverables: Hoverable[] = [];
  const add = (mesh: THREE.Mesh, x: number, y: number, z: number, ry: number, label: string, info: string) => {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.baseEmissive = 0;
    group.add(mesh);
    hoverables.push({ object: mesh, label, info });
  };

  add(
    new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 3.2), WOOD()),
    -3.2, 0.5, 0.4, 0.15,
    'BELKA', 'Belka nośna — przekrój dobrany pod rozpiętość stropu.',
  );
  add(
    new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.045, 0.28), WOOD()),
    -0.6, 0.36, -1.4, -0.1,
    'DESKA', 'Deska konstrukcyjna — przetarta i sezonowana we własnym tartaku.',
  );
  add(
    new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 2.4), WOOD()),
    1.6, 0.75, 0.8, 0.5,
    'KROKWIA', 'Krokiew — element więźby dachowej, kąt cięcia pod konkretny dach.',
  );
  add(
    new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 0.24), WOOD()),
    3.4, 1.1, -0.6, 0,
    'SŁUP', 'Słup konstrukcyjny — przenosi obciążenie z więźby na fundament.',
  );
  add(
    new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), WOOD()),
    0.4, 0.4, 2.1, 0.4,
    'ELEMENT KONSTRUKCYJNY', 'Łącznik ciesielski — łączenie na styk, bez ukrytych kompromisów.',
  );

  return { group, hoverables };
}
