import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { createStudioRig } from '../../lib/kit/rigs/lighting-studio.js';

/** 1x256 vertical gradient used as the backdrop, from the skill's scaffold scene. */
function gradientSky(zenith: string, horizon: string): THREE.CanvasTexture {
  const canvas = Object.assign(document.createElement('canvas'), { width: 1, height: 256 });
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, zenith);
  gradient.addColorStop(1, horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The three-panel product studio from the skill's lighting-studio rig
 * (knowledge.lighting-mood-dark-studio-product), lifted out of the dark end of its range:
 * a pallet is a matte wooden object, and at the preset's own environment intensity the grain
 * disappears. Panel geometry, angles and the key:fill ratio are the rig's.
 */
export function Lighting(): JSX.Element | null {
  const { scene, gl } = useThree();

  useEffect(() => {
    const rig = createStudioRig(scene, gl, {
      subject: [0, 0.35, 0],
      distance: 3.1,
      environmentIntensity: 0.45,
      // Key pulled back and cooled: at 16 the warm panel drove the wood into orange under ACES,
      // which read as plastic rather than pine. More fill keeps the shadow side legible.
      key: { color: '#fff8f0', intensity: 12.5, width: 1.6, height: 2.2, elevationDeg: 38, azimuthDeg: 315 },
      fill: { color: '#e8f0ff', intensity: 6.2, width: 2.4, height: 1.4, elevationDeg: 14, azimuthDeg: 65 },
      rim: { color: '#ffffff', intensity: 11, width: 0.5, height: 1.8, elevationDeg: 28, azimuthDeg: 168 },
      contact: { color: '#ffffff', intensity: 1.1, mapSize: 1024, bias: -0.0002, normalBias: 0.02, extent: 4 },
    });

    const sky = gradientSky('#1b1a17', '#3b352e');
    scene.background = sky;
    scene.fog = new THREE.Fog('#241f1b', 5, 15);

    return () => {
      rig.dispose();
      sky.dispose();
      scene.background = null;
      scene.fog = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
