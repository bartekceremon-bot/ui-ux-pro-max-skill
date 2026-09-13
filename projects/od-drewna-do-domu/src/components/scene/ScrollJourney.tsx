import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MobileFallback } from './MobileFallback';
import { useActiveBeat } from './useActiveBeat';
import { setScrollProgress, subscribeScroll } from './scrollStore';
import { useCanRender3D, useReducedMotion } from '../../hooks/usePreferences';
import type { JourneySelection } from './JourneyScene';
import styles from './ScrollJourney.module.css';

gsap.registerPlugin(ScrollTrigger);

// three.js + @react-three/fiber are the heaviest dependency in the app by far; splitting them
// into their own chunk keeps the marketing copy (and its SEO text) fast on the initial load,
// and desktop-only users are the only ones who ever pay for this download at all.
const JourneyCanvas = lazy(() => import('./JourneyCanvas').then((m) => ({ default: m.JourneyCanvas })));

export function ScrollJourney(): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const can3D = useCanRender3D();
  const reducedMotion = useReducedMotion();
  const beat = useActiveBeat();
  const [hover, setHover] = useState<string | null>(null);
  const [selection, setSelection] = useState<JourneySelection>(null);
  const [progressPct, setProgressPct] = useState(0);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reducedMotion ? true : 0.35,
      onUpdate: (self) => setScrollProgress(self.progress),
    });
    return () => trigger.kill();
  }, [reducedMotion]);

  useEffect(() => subscribeScroll((t) => setProgressPct(Math.round(t * 100))), []);

  return (
    <section id="podroz" className={styles.wrapper} ref={wrapperRef} aria-label="Podróż: od drzewa do domu">
      <div className={styles.sticky}>
        {can3D ? (
          <Suspense fallback={<div className={styles.loading} aria-hidden="true" />}>
            <JourneyCanvas reducedMotion={reducedMotion} onHover={setHover} onSelect={setSelection} />
          </Suspense>
        ) : (
          <MobileFallback />
        )}

        {can3D && (
          <div className={styles.overlay} aria-hidden={false}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>

            <div className={styles.textBlock} key={beat.id}>
              <p className={styles.kicker}>{beat.kicker}</p>
              <h2 className={styles.line}>{beat.line}</h2>
            </div>

            {hover && (
              <div className={styles.hoverChip} role="status">
                {hover}
              </div>
            )}

            {selection && (
              <div className={styles.infoCard} role="dialog" aria-label={selection.title}>
                <button type="button" className={styles.infoClose} onClick={() => setSelection(null)} aria-label="Zamknij">
                  ×
                </button>
                <p className={styles.infoTitle}>{selection.title}</p>
                <p className={styles.infoBody}>{selection.body}</p>
              </div>
            )}

            {beat.id === 'dom' && !selection && (
              <p className={styles.hint}>Kliknij ścianę lub dach modelu, aby zobaczyć konstrukcję</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
