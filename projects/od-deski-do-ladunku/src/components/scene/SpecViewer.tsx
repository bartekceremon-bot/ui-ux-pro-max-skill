import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Lighting } from './Lighting';
import { createMaterials } from './builders/materials';
import { buildPallet, type PalletPartHandle } from './builders/pallet';
import { buildStudio } from './builders/studio';
import type { PalletPart } from './builders/palletParts';
import styles from './SpecViewer.module.css';

const DEFAULT_VIEW = {
  position: new THREE.Vector3(1.5, 0.98, 1.6),
  target: new THREE.Vector3(0, 0.12, 0),
};

type SceneProps = {
  explodeTarget: number;
  selectedId: string | null;
  onPick: (part: PalletPart | null) => void;
  onHover: (hovering: boolean) => void;
};

function SpecScene({ explodeTarget, selectedId, onPick, onHover }: SceneProps): JSX.Element {
  const { camera, gl, invalidate } = useThree();
  const root = useRef<THREE.Group>(null);

  const materials = useMemo(() => createMaterials(), []);
  const studio = useMemo(() => buildStudio(materials), [materials]);
  const pallet = useMemo(() => buildPallet(materials, 4), [materials]);
  const outline = useMemo(() => {
    const mesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: '#e7b877', transparent: true, opacity: 0.95 }),
    );
    mesh.visible = false;
    return mesh;
  }, []);

  const explode = useRef(0);
  const camPosition = useRef(DEFAULT_VIEW.position.clone());
  const camTarget = useRef(DEFAULT_VIEW.target.clone());
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pickables = useMemo(() => pallet.parts.map((entry) => entry.mesh), [pallet]);
  const byId = useMemo(() => {
    const map = new Map<string, PalletPartHandle>();
    pallet.parts.forEach((entry) => map.set(entry.part.id, entry));
    return map;
  }, [pallet]);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    studio.updateTimber(0);
    pallet.update({ boards: 1, components: 1, assembly: 1 });
    group.add(studio.group, pallet.group, outline);
    camera.position.copy(DEFAULT_VIEW.position);
    camera.lookAt(DEFAULT_VIEW.target);
    invalidate();
    return () => {
      group.remove(studio.group, pallet.group, outline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => invalidate(), [explodeTarget, selectedId, invalidate]);

  // Pointer handling on the canvas element: one raycast per event, no always-on hit testing.
  useEffect(() => {
    const canvas = gl.domElement;
    const ndc = new THREE.Vector2();
    const toNdc = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      return ndc;
    };
    const hit = (event: PointerEvent) => {
      raycaster.setFromCamera(toNdc(event), camera);
      return raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined;
    };
    const onMove = (event: PointerEvent) => onHover(Boolean(hit(event)));
    const onDown = (event: PointerEvent) => {
      const mesh = hit(event);
      const id = mesh?.userData.partId as string | undefined;
      onPick(id ? byId.get(id)!.part : null);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, byId, pickables]);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    let busy = false;

    // Exploded view: ease the display offset, never the rest transforms themselves.
    if (Math.abs(explode.current - explodeTarget) > 0.001) {
      explode.current += (explodeTarget - explode.current) * Math.min(1, step * 4.5);
      pallet.setExplode(explode.current);
      pallet.update({ boards: 1, components: 1, assembly: 1 });
      busy = true;
    }

    const selected = selectedId ? byId.get(selectedId) : undefined;
    if (selected) {
      const size = Math.max(...selected.part.size);
      selected.mesh.getWorldPosition(desiredTarget);
      desiredPosition
        .set(0.72, 0.52, 0.86)
        .normalize()
        .multiplyScalar(size * 1.35 + 0.62)
        .add(desiredTarget);
      outline.visible = true;
      outline.position.copy(selected.mesh.position);
      outline.rotation.copy(selected.mesh.rotation);
      outline.scale.set(selected.part.size[0] * 1.03, selected.part.size[1] * 1.35, selected.part.size[2] * 1.03);
    } else {
      desiredPosition.copy(DEFAULT_VIEW.position);
      desiredTarget.copy(DEFAULT_VIEW.target);
      outline.visible = false;
    }

    if (camPosition.current.distanceToSquared(desiredPosition) > 1e-6 || camTarget.current.distanceToSquared(desiredTarget) > 1e-6) {
      const k = Math.min(1, step * 3.2);
      camPosition.current.lerp(desiredPosition, k);
      camTarget.current.lerp(desiredTarget, k);
      camera.position.copy(camPosition.current);
      camera.lookAt(camTarget.current);
      busy = true;
    }

    if (busy) invalidate();
  });

  return (
    <>
      <Lighting />
      <group ref={root} />
    </>
  );
}

/**
 * A second, deliberately cheap canvas: it renders on demand (a click, a tween frame) and sits
 * idle the rest of the time, so having an interactive model on the page costs nothing while
 * nobody is touching it.
 */
export function SpecViewer(): JSX.Element {
  const [exploded, setExploded] = useState(false);
  const [selected, setSelected] = useState<PalletPart | null>(null);
  const [hovering, setHovering] = useState(false);

  return (
    <div className={styles.viewer}>
      <div className={styles.canvasWrap} style={{ cursor: hovering ? 'pointer' : 'default' }}>
        <Canvas
          shadows
          frameloop="demand"
          dpr={[1, 1.6]}
          gl={{ antialias: true }}
          camera={{ position: [1.5, 0.98, 1.6], fov: 36, near: 0.05, far: 40 }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.98;
          }}
        >
          <SpecScene
            explodeTarget={exploded ? 1 : 0}
            selectedId={selected?.id ?? null}
            onPick={setSelected}
            onHover={setHovering}
          />
        </Canvas>

        <div className={styles.controls}>
          <button type="button" className="btn btn-ghost" onClick={() => setExploded((value) => !value)}>
            {exploded ? 'Złóż paletę' : 'Zobacz konstrukcję'}
          </button>
        </div>
      </div>

      <aside className={styles.panel} aria-live="polite">
        {selected ? (
          <>
            <p className={styles.panelKicker}>Wybrany element</p>
            <h3 className={styles.panelTitle}>{selected.label}</h3>
            <dl className={styles.facts}>
              <div>
                <dt>Wymiar</dt>
                <dd>{selected.spec.wymiar}</dd>
              </div>
              <div>
                <dt>Materiał</dt>
                <dd>{selected.spec.material}</dd>
              </div>
            </dl>
            <p className={styles.panelInfo}>{selected.spec.info}</p>
            <button type="button" className={styles.clear} onClick={() => setSelected(null)}>
              Wyczyść wybór
            </button>
          </>
        ) : (
          <>
            <p className={styles.panelKicker}>Model interaktywny</p>
            <h3 className={styles.panelTitle}>Kliknij element palety</h3>
            <p className={styles.panelInfo}>
              Deska górna, wspornik nośny, klocek, deska dolna — kamera przybliży wybrany element i pokaże jego dane.
              Dane wymiarowe uzupełniamy na etapie wyceny.
            </p>
            <ul className={styles.legend}>
              <li>20 elementów konstrukcyjnych</li>
              <li>Widok eksplodowany</li>
              <li>Wymiary do uzupełnienia</li>
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
