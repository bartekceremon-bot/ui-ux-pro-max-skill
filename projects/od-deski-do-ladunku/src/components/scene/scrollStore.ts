/**
 * Scroll progress lives outside React state on purpose: ScrollTrigger writes it every tick and
 * useFrame reads it every frame, so nothing here should trigger a component re-render.
 */
export const scrollState = { t: 0 };

type Listener = (t: number) => void;
const listeners = new Set<Listener>();

export function setScrollProgress(t: number): void {
  scrollState.t = t;
  listeners.forEach((fn) => fn(t));
}

/** For the DOM text overlay, which does need to re-render, but only on beat change — see useBeat. */
export function subscribeScroll(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Lighting writes the current fog colour here each frame; the corridor dividers read it back
 * a frame late rather than fighting over useFrame ordering between sibling components. */
export const moodState = { fogHex: 0xdfe6d6 };
