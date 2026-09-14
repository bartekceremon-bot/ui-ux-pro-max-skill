import { useEffect, useState } from 'react';

/** Tracks prefers-reduced-motion so the journey scene can drop camera moves and sway. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * How much scene this device should be asked to draw.
 *
 * - `none`   — no WebGL at all: narrow viewport, few cores, or no context. Gets the vector story.
 * - `light`  — tablet-sized: the same scene, but fewer moving objects and a lower pixel budget,
 *              per the brief's rule that a phone or tablet must not be handed the desktop scene
 *              shrunk with CSS.
 * - `full`   — desktop.
 */
export type SceneTier = 'none' | 'light' | 'full';

function measureTier(): SceneTier {
  if (typeof window === 'undefined') return 'none';
  const cores = navigator.hardwareConcurrency ?? 4;
  let hasWebgl = false;
  try {
    const canvas = document.createElement('canvas');
    hasWebgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    hasWebgl = false;
  }
  if (!hasWebgl || cores < 4 || !window.matchMedia('(min-width: 900px)').matches) return 'none';
  return window.matchMedia('(min-width: 1280px)').matches ? 'full' : 'light';
}

export function useSceneTier(): SceneTier {
  // Starts at 'none' on purpose: the first paint carries no WebGL, and the tier is measured after
  // mount, so a device that cannot take the scene never briefly starts one.
  const [tier, setTier] = useState<SceneTier>('none');

  useEffect(() => {
    const update = () => setTier(measureTier());
    update();
    const queries = [window.matchMedia('(min-width: 900px)'), window.matchMedia('(min-width: 1280px)')];
    queries.forEach((query) => query.addEventListener('change', update));
    return () => queries.forEach((query) => query.removeEventListener('change', update));
  }, []);

  return tier;
}

/**
 * Decides whether the device should get WebGL at all.
 * Per the brief: "Na mobile nie próbuj na siłę uruchamiać ciężkiej sceny."
 */
export function useCanRender3D(): boolean {
  return useSceneTier() !== 'none';
}
