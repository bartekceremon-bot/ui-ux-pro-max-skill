import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Lighting } from './Lighting';
import { buildForest } from './builders/forest';
import { buildTreeCloseup } from './builders/treeCloseup';
import { buildSawmill } from './builders/sawmill';
import { buildSelection } from './builders/selection';
import { buildHouse, type ClickTarget } from './builders/house';
import { buildDividers } from './builders/dividers';
import { BEATS, beatAt, localProgress, sampleCamera } from './journeyConfig';
import { scrollState } from './scrollStore';
import type { Hoverable } from './builders/shared';

export type JourneySelection = { title: string; body: string } | null;

type Props = {
  reducedMotion: boolean;
  onHover: (label: string | null) => void;
  onSelect: (info: JourneySelection) => void;
};

export function JourneyScene({ reducedMotion, onHover, onSelect }: Props): JSX.Element {
  const { camera, gl } = useThree();
  const root = useRef<THREE.Group>(null);

  const forest = useMemo(() => buildForest(), []);
  const tree = useMemo(() => buildTreeCloseup(), []);
  const sawmill = useMemo(() => buildSawmill(), []);
  const selection = useMemo(() => buildSelection(), []);
  const house = useMemo(() => buildHouse(), []);
  const dividers = useMemo(() => buildDividers(), []);

  const hoverables: Hoverable[] = selection.hoverables;
  const clickTargets: ClickTarget[] = house.clickTargets;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const hoveredRef = useRef<THREE.Object3D | null>(null);
  const activeBeatRef = useRef('');

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    group.add(forest.group, tree.group, sawmill.group, selection.group, house.group, dividers.group);
    return () => {
      group.remove(forest.group, tree.group, sawmill.group, selection.group, house.group, dividers.group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dt) => {
    const t = scrollState.t;
    const beat = beatAt(t);
    if (beat.id !== activeBeatRef.current) {
      activeBeatRef.current = beat.id;
    }

    const cam = sampleCamera(t);
    camera.position.set(...cam.position);
    camera.lookAt(...cam.target);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = cam.fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }

    const step = reducedMotion ? 0 : Math.min(dt, 0.05);
    forest.update(step);
    tree.update(localProgress(t, BEATS[1]), step);
    sawmill.update(localProgress(t, BEATS[2]), step);
    house.updateConstruction(localProgress(t, BEATS[4]));
    house.updateGarden(localProgress(t, BEATS[5]), step);
    dividers.update(t);

    // Hover only matters during the selection beat; skip raycasting the rest of the time.
    if (beat.id === 'obrobka') {
      raycaster.setFromCamera(state.pointer, camera);
      const hit = raycaster.intersectObjects(hoverables.map((h) => h.object), false)[0]?.object ?? null;
      if (hit !== hoveredRef.current) {
        hoveredRef.current = hit;
        const found = hoverables.find((h) => h.object === hit);
        onHover(found?.label ?? null);
      }
    } else if (hoveredRef.current) {
      hoveredRef.current = null;
      onHover(null);
    }
  });

  // A plain DOM listener plus our own raycaster, deliberately bypassing R3F's built-in event
  // system: that system re-tests the whole scene graph on every pointer move, which is wasted
  // work here since only the "dom" beat's three hit-boxes are ever clickable.
  useEffect(() => {
    const canvas = gl.domElement;
    const ndc = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      const beat = beatAt(scrollState.t);
      if (beat.id !== 'dom') return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(clickTargets.map((c) => c.object), false)[0]?.object;
      const target = clickTargets.find((c) => c.object === hit);
      if (target) {
        target.toggle?.();
        onSelect({ title: target.title, body: target.body });
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  return (
    <>
      <Lighting />
      <group ref={root} />
    </>
  );
}
