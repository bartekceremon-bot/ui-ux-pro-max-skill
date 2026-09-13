import { useEffect, useRef } from 'react';

/**
 * Adds `.is-visible` the first time an element crosses the viewport — CSS owns the animation.
 *
 * Threshold stays at 0 on purpose. A ratio-based threshold silently fails on a section taller
 * than the viewport (it can never be 20% visible), which would leave that whole section stuck at
 * `opacity: 0` on a phone. The bottom rootMargin is what delays the reveal until the block has
 * actually entered reading height.
 */
export function useReveal<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const show = () => {
      el.classList.add('is-visible');
      // Also mark any staggered children so a single observer can reveal a whole group.
      el.querySelectorAll('.reveal').forEach((child) => child.classList.add('is-visible'));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            observer.disconnect();
          }
        }
      },
      { threshold: 0, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return ref;
}
