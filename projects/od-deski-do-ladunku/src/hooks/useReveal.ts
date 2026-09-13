import { useEffect, useRef } from 'react';

/** Adds `.is-visible` the first time an element crosses the viewport — CSS owns the animation. */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Also mark any staggered children so a single observer can reveal a whole group.
            entry.target.querySelectorAll('.reveal').forEach((child) => child.classList.add('is-visible'));
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
