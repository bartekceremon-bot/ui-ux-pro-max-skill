import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { JourneyScene, type JourneySelection } from './JourneyScene';

type Props = {
  reducedMotion: boolean;
  onHover: (label: string | null) => void;
  onSelect: (info: JourneySelection) => void;
};

/**
 * WebGL context loss on a scrollytelling page kills the whole hero, so we catch it explicitly
 * and fall back to a plain gradient rather than an empty black rectangle.
 */
export function JourneyCanvas({ reducedMotion, onHover, onSelect }: Props): JSX.Element {
  const [lost, setLost] = useState(false);

  if (lost) {
    return (
      <div
        role="img"
        aria-label="Ilustracja: droga od lasu do gotowego domu"
        style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg,#dfe6d6,#c9a878 55%,#6b4f34)' }}
      />
    );
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.7, 8], fov: 42, near: 0.1, far: 80 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          setLost(true);
        });
      }}
    >
      <Suspense fallback={null}>
        <JourneyScene reducedMotion={reducedMotion} onHover={onHover} onSelect={onSelect} />
      </Suspense>
    </Canvas>
  );
}
