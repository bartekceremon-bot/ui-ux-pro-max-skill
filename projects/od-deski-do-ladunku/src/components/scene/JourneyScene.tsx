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
import type { SceneTier } from '../../hooks/usePreferences';

/** Eased 0..1 ramp between two scroll positions. */
function smooth(t: number, from: number, to: number) {
  const c = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return c * c * (3 - 2 * c);
}

/**
 * One studio, one product. Scroll drives a single timeline: the material becomes boards, the
 * boards become a pallet, the pallet takes a load, and the load leaves on a truck. Nothing here
 * decides *when* — journeyConfig owns the timing, this owns the wiring.
 */
export function JourneyScene({ tier }: { tier: SceneTier }): JSX.Element {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);

  const materials = useMemo(() => createMaterials(), []);
  const studio = useMemo(() => buildStudio(materials), [materials]);
  const pallet = useMemo(() => buildPallet(materials), [materials]);
  const load = useMemo(() => buildLoad(materials), [materials]);
  const forklift = useMemo(() => buildForklift(materials), [materials]);
  /** Pallet and load ride up together on the forks; the truck lifts its own carriage. */
  const liftGroup = useMemo(() => new THREE.Group(), []);
  /** Scratch vector for the camera pan, allocated once rather than per frame. */
  const pan = useMemo(() => new THREE.Vector3(), []);

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

  useFrame((state) => {
    if (import.meta.env.DEV) {
      // Draw-call budget probe for local profiling; stripped from production builds.
      (window as unknown as { __pallet?: unknown }).__pallet = pallet;
      (window as unknown as { __sceneInfo?: unknown }).__sceneInfo = {
        calls: state.gl.info.render.calls,
        triangles: state.gl.info.render.triangles,
        geometries: state.gl.info.memory.geometries,
        textures: state.gl.info.memory.textures,
      };
    }
    const t = scrollState.t;
    const phases = phasesAt(t);

    let shot = sampleCamera(t);
    if (import.meta.env.DEV) {
      // Camera framing rig: set window.__camOverride from the console (or a screenshot script) to
      // try a keyframe without a rebuild. Stripped from production builds.
      const override = (window as unknown as { __camOverride?: typeof shot }).__camOverride;
      if (override) shot = override;
    }
    camera.position.set(...shot.position);
    camera.lookAt(...shot.target);
    // Horizontal pan: slide camera and look-at together along the camera's right axis, so the
    // subject moves across the frame without the viewing angle changing.
    if (shot.shift) {
      pan.set(...shot.target).sub(camera.position).normalize().cross(camera.up).normalize();
      camera.position.addScaledVector(pan, shot.shift);
      camera.lookAt(
        shot.target[0] + pan.x * shot.shift,
        shot.target[1] + pan.y * shot.shift,
        shot.target[2] + pan.z * shot.shift,
      );
    }
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera;
      if (perspective.fov !== shot.fov) {
        perspective.fov = shot.fov;
        perspective.updateProjectionMatrix();
      }
    }

    studio.updateTimber(phases.timber);

    // A breath of movement while the product is the subject, so a reader who stops scrolling is
    // not looking at a freeze frame. It fades out before the truck arrives — the forks have to
    // line up with the pockets, and they cannot do that against a turning pallet.
    const alive = Math.min(smooth(t, 0.62, 0.7), 1 - smooth(t, 0.86, 0.92));
    liftGroup.rotation.y = Math.sin(state.clock.elapsedTime * 0.32) * 0.075 * Math.max(0, alive);

    pallet.update({ boards: phases.boards, components: phases.components, assembly: phases.assembly });
    load.update(phases.cartons, phases.film);
    const liftHeight = forklift.update(phases.approach, phases.lift);
    liftGroup.position.y = liftHeight;
    studio.updateGrounding(liftHeight);
  });

  return (
    <>
      <Lighting tier={tier} />
      <group ref={root} />
    </>
  );
}
