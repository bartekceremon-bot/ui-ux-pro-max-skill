import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Lighting } from './Lighting';
import { createMaterials } from './builders/materials';
import { buildStudio } from './builders/studio';
import { buildPallet } from './builders/pallet';
import { buildLoad } from './builders/load';
import { buildForklift } from './builders/forklift';
import { phasesAt, sampleCamera } from './journeyConfig';
import { scrollState } from './scrollStore';

/**
 * One studio, one product. Scroll drives a single timeline: the material becomes boards, the
 * boards become a pallet, the pallet takes a load, and the load leaves on a truck. Nothing here
 * decides *when* — journeyConfig owns the timing, this owns the wiring.
 */
export function JourneyScene(): JSX.Element {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);

  const materials = useMemo(() => createMaterials(), []);
  const studio = useMemo(() => buildStudio(materials), [materials]);
  const pallet = useMemo(() => buildPallet(materials), [materials]);
  const load = useMemo(() => buildLoad(materials), [materials]);
  const forklift = useMemo(() => buildForklift(materials), [materials]);
  /** Pallet and load ride up together on the forks; the truck lifts its own carriage. */
  const liftGroup = useMemo(() => new THREE.Group(), []);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    liftGroup.add(pallet.group, load.group);
    group.add(studio.group, liftGroup, forklift.group);
    return () => {
      group.remove(studio.group, liftGroup, forklift.group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const t = scrollState.t;
    const phases = phasesAt(t);

    const shot = sampleCamera(t);
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera;
      if (perspective.fov !== shot.fov) {
        perspective.fov = shot.fov;
        perspective.updateProjectionMatrix();
      }
    }

    studio.updateTimber(phases.timber);
    pallet.update({ boards: phases.boards, components: phases.components, assembly: phases.assembly });
    load.update(phases.cartons, phases.film);
    liftGroup.position.y = forklift.update(phases.approach, phases.lift);
  });

  return (
    <>
      <Lighting />
      <group ref={root} />
    </>
  );
}
