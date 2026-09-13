import { Suspense, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { JourneyScene } from './JourneyScene';

type Props = {
  /** The scene only renders while the pinned section is on screen. */
  active: boolean;
};

export function JourneyCanvas({ active }: Props): JSX.Element {
  const [lost, setLost] = useState(false);

  if (lost) {
    return (
      <div
        role="img"
        aria-label="Ilustracja: paleta z ładunkiem gotowym do transportu"
        style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#241f1b,#6d4a27 60%,#b8834a)' }}
      />
    );
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0.62, 0.3, 0.92], fov: 34, near: 0.05, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.98;
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          setLost(true);
        });
      }}
    >
      <Suspense fallback={null}>
        <JourneyScene />
      </Suspense>
    </Canvas>
  );
}
