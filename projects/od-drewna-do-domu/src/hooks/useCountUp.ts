import { useEffect, useRef } from 'react';

/** Counts a <span> from 0 to `value` once it scrolls into view. Skips entirely under reduced motion. */
export function useCountUp(value: number, durationMs = 900) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.textContent = String(value).padStart(2, '0');
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - (1 - t) * (1 - t);
            el.textContent = String(Math.round(eased * value)).padStart(2, '0');
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return ref;
}
