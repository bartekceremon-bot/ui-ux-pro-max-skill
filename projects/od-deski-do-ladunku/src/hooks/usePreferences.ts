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
 * Decides whether the device should get the full WebGL journey or the CSS fallback.
 * Narrow viewports and devices that report a low core count skip the heavy scene entirely,
 * per the brief: "Na mobile nie próbuj na siłę uruchamiać ciężkiej sceny."
 */
export function useCanRender3D(): boolean {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const cores = navigator.hardwareConcurrency ?? 4;
    let hasWebgl = false;
    try {
      const canvas = document.createElement('canvas');
      hasWebgl = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      hasWebgl = false;
    }
    setCanRender(wide && cores >= 4 && hasWebgl);

    const query = window.matchMedia('(min-width: 900px)');
    const onChange = () => setCanRender(query.matches && cores >= 4 && hasWebgl);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return canRender;
}
