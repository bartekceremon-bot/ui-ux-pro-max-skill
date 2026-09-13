import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { moodState, scrollState } from './scrollStore';

/**
 * Two moods lifted from the skill's lighting-sun rig: a soft morning key for most of the walk,
 * and knowledge.lighting-mood-dusk-golden-hour — used verbatim — for the finished-house reveal.
 * Only the blend between them is new; the numbers themselves come from templates/rigs/lighting-sun.js.
 */
const MORNING = {
  color: new THREE.Color('#fdf1da'), intensity: 1.9, elevationDeg: 38, azimuthDeg: 205,
  skyColor: new THREE.Color('#bcd3d9'), groundColor: new THREE.Color('#5a6b4c'), fillIntensity: 0.75,
  rimColor: new THREE.Color('#eaf2ff'), rimIntensity: 0.25, rimElevationDeg: 50, rimAzimuthDeg: 30,
  fog: new THREE.Color('#dfe6d6'), zenith: new THREE.Color('#e8efe2'),
};
const GOLDEN = {
  color: new THREE.Color('#ffb46b'), intensity: 3.2, elevationDeg: 6, azimuthDeg: 250,
  skyColor: new THREE.Color('#6f8fc9'), groundColor: new THREE.Color('#4a3a2a'), fillIntensity: 0.5,
  rimColor: new THREE.Color('#ffd9a8'), rimIntensity: 0.8, rimElevationDeg: 12, rimAzimuthDeg: 70,
  fog: new THREE.Color('#e8caa0'), zenith: new THREE.Color('#6f8fc9'),
};

/**
 * Positions `light` at a fixed spherical offset from `target` rather than from the world origin.
 * The corridor is 64 units long and the key light's target follows the camera down it — a light
 * anchored to the origin (a fixed ~26-unit offset that only lines up near z = 0) leaves its
 * shadow frustum pointed at empty space for every set past the first one, which reads as
 * missing shadows near the camera and stray partial ones wherever the mismatched frustum happens
 * to clip real geometry. Anchoring to the target keeps the sun in the same relative position
 * (and its shadow coverage centred on whatever the camera is actually looking at) the whole walk.
 */
function place(light: THREE.DirectionalLight, elevationDeg: number, azimuthDeg: number, distance = 26) {
  const offset = new THREE.Vector3().setFromSphericalCoords(distance, THREE.MathUtils.degToRad(90 - elevationDeg), THREE.MathUtils.degToRad(azimuthDeg));
  light.position.copy(light.target.position).add(offset);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const c = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return c * c * (3 - 2 * c);
}

/**
 * 1x256 vertical gradient, straight out of the skill's scaffold scene.js: cheap, and it removes
 * the hard horizon line a flat background color leaves where the ground mesh ends.
 */
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

function paintSky(texture: THREE.CanvasTexture, zenith: THREE.Color, horizon: THREE.Color) {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${zenith.getHexString()}`);
  gradient.addColorStop(1, `#${horizon.getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;
}

export function Lighting(): JSX.Element {
  const { scene } = useThree();
  const key = useMemo(() => new THREE.DirectionalLight('#fff', 1), []);
  const fill = useMemo(() => new THREE.HemisphereLight('#fff', '#333', 1), []);
  const rim = useMemo(() => new THREE.DirectionalLight('#fff', 0), []);
  const scratchColor = useRef(new THREE.Color());
  const sky = useMemo(() => gradientSky(`#${MORNING.zenith.getHexString()}`, `#${MORNING.fog.getHexString()}`), []);
  const lastBlend = useRef(-1);

  useEffect(() => {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.03;
    const box = key.shadow.camera as THREE.OrthographicCamera;
    box.left = box.bottom = -24;
    box.right = box.top = 24;
    box.near = 1;
    box.far = 60;
    box.updateProjectionMatrix();
    rim.target = key.target;
    scene.add(key, fill, rim);
    scene.fog = new THREE.FogExp2(MORNING.fog.getHex(), 0.045);
    scene.background = sky;
    return () => {
      scene.remove(key, fill, rim);
      sky.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    const t = scrollState.t;
    const blend = smoothstep(0.74, 1.0, t);

    key.target.position.set(0, 1.4, -46 * t);
    key.target.updateMatrixWorld();

    key.color.copy(scratchColor.current.copy(MORNING.color).lerp(GOLDEN.color, blend));
    key.intensity = THREE.MathUtils.lerp(MORNING.intensity, GOLDEN.intensity, blend);
    const elevation = THREE.MathUtils.lerp(MORNING.elevationDeg, GOLDEN.elevationDeg, blend);
    const azimuth = THREE.MathUtils.lerp(MORNING.azimuthDeg, GOLDEN.azimuthDeg, blend);
    place(key, elevation, azimuth);

    fill.color.copy(scratchColor.current.copy(MORNING.skyColor).lerp(GOLDEN.skyColor, blend));
    (fill.groundColor as THREE.Color).copy(scratchColor.current.copy(MORNING.groundColor).lerp(GOLDEN.groundColor, blend));
    fill.intensity = THREE.MathUtils.lerp(MORNING.fillIntensity, GOLDEN.fillIntensity, blend);

    rim.color.copy(scratchColor.current.copy(MORNING.rimColor).lerp(GOLDEN.rimColor, blend));
    rim.intensity = THREE.MathUtils.lerp(MORNING.rimIntensity, GOLDEN.rimIntensity, blend);
    place(rim, THREE.MathUtils.lerp(MORNING.rimElevationDeg, GOLDEN.rimElevationDeg, blend), THREE.MathUtils.lerp(MORNING.rimAzimuthDeg, GOLDEN.rimAzimuthDeg, blend), 20);

    const fogColor = scratchColor.current.copy(MORNING.fog).lerp(GOLDEN.fog, blend);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(fogColor);
      scene.fog.density = THREE.MathUtils.lerp(0.045, 0.03, blend);
    }
    moodState.fogHex = fogColor.getHex();
    if (Math.abs(blend - lastBlend.current) > 0.01) {
      lastBlend.current = blend;
      const zenith = scratchColor.current.copy(MORNING.zenith).lerp(GOLDEN.zenith, blend).clone();
      paintSky(sky, zenith, fogColor.clone());
    }
  });

  return <primitive object={key.target} />;
}
