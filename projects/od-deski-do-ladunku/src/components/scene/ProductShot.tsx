import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Lighting } from './Lighting';
import { useReducedMotion } from '../../hooks/usePreferences';
import { createMaterials } from './builders/materials';
import { buildPallet } from './builders/pallet';
import { buildStudio } from './builders/studio';
import styles from './ProductShot.module.css';

/**
 * How one product differs from the standard pallet, expressed against the same 20-part model the
 * rest of the site uses: nothing here invents a second pallet, it dresses the one we build.
 * `deckScale` is a thickness multiplier on the boards; `hidden` removes parts a type does not have.
 */
export type ShotVariant = {
  deckScale?: number;
  blockScale?: number;
  hidden?: string[];
};

/** Two framings: the finished product, and the sawn stock it is cut from. */
const VIEWS = {
  pallet: { position: new THREE.Vector3(1.42, 0.86, 1.52), target: new THREE.Vector3(0, 0.1, 0), fov: 30 },
  timber: { position: new THREE.Vector3(1.72, 0.98, 1.95), target: new THREE.Vector3(0, 0.16, 0), fov: 30 },
} as const;

export type ShotSubject = keyof typeof VIEWS;

function Scene({ variant, subject }: { variant: ShotVariant; subject: ShotSubject }): JSX.Element {
  const { camera, invalidate } = useThree();
  const root = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const reducedMotion = useReducedMotion();

  const materials = useMemo(() => createMaterials(), []);
  const studio = useMemo(() => buildStudio(materials), [materials]);
  const pallet = useMemo(() => buildPallet(materials, 9), [materials]);

  useEffect(() => {
    const group = root.current;
    if (!group) return undefined;
    studio.updateTimber(subject === 'timber' ? 1 : 0);
    // No backdrop plate in a section-embedded shot: the page's own ground shows through instead.
    studio.cyclorama.visible = false;
    pallet.update({ boards: 1, components: 1, assembly: 1 });
    pallet.group.visible = subject === 'pallet';
    group.add(studio.group, pallet.group);
    const view = VIEWS[subject];
    camera.position.copy(view.position);
    (camera as THREE.PerspectiveCamera).fov = view.fov;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    camera.lookAt(view.target);
    invalidate();
    return () => {
      group.remove(studio.group, pallet.group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the variant. Scaling a board about its own centre would sink half its new thickness
  // into the part below, so each one is nudged up by what it gained.
  useEffect(() => {
    const hidden = new Set(variant.hidden ?? []);
    for (const { part, mesh } of pallet.parts) {
      mesh.visible = !hidden.has(part.id);
      const isDeck = part.kind === 'top' || part.kind === 'bottom';
      const scale = isDeck ? variant.deckScale ?? 1 : part.kind === 'block' ? variant.blockScale ?? 1 : 1;
      mesh.scale.y = scale;
      mesh.position.y = part.rest[1] + (part.size[1] * (scale - 1)) / 2;
    }
    // Under reduced motion the product simply appears in its new state; no turn-in.
    spin.current = reducedMotion ? 1 : 0;
    invalidate();
  }, [variant, pallet, invalidate, reducedMotion]);

  // A short settle after every change: the product turns a few degrees into its new pose instead
  // of snapping, which is what makes the switch read as the same object rather than a new image.
  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    if (spin.current < 1) {
      spin.current = Math.min(1, spin.current + delta * 1.6);
      const eased = 1 - Math.pow(1 - spin.current, 3);
      group.rotation.y = (1 - eased) * -0.22;
      invalidate();
    }
  });

  return (
    <group ref={root}>
      <Lighting backdrop={false} />
    </group>
  );
}

export function ProductShot({
  variant = {},
  subject = 'pallet',
}: {
  variant?: ShotVariant;
  subject?: ShotSubject;
}): JSX.Element {
  return (
    <div className={styles.stage}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [1.42, 0.86, 1.52], fov: 30, near: 0.05, far: 40 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.02;
        }}
      >
        <Scene variant={variant} subject={subject} />
      </Canvas>
    </div>
  );
}
