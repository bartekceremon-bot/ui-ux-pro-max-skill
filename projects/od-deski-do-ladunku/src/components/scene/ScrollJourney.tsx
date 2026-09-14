import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MobileFallback } from './MobileFallback';
import { useActiveBeat } from './useActiveBeat';
import { BEATS } from './journeyConfig';
import { setScrollProgress, subscribeScroll } from './scrollStore';
import { useCanRender3D, useReducedMotion } from '../../hooks/usePreferences';
import styles from './ScrollJourney.module.css';

gsap.registerPlugin(ScrollTrigger);

// three.js is by far the heaviest dependency here; splitting it out keeps the copy, the offer
// and the SEO text fast, and phones never download it at all because they get the fallback.
const JourneyCanvas = lazy(() => import('./JourneyCanvas').then((m) => ({ default: m.JourneyCanvas })));

/** The hero lives inside the pinned stage so the page opens on the product, not on a picture of it. */
function Hero({ overlay }: { overlay: boolean }): JSX.Element {
  return (
    <div className={overlay ? styles.hero : `${styles.hero} ${styles.heroFlat}`} id="top">
      <p className={styles.heroEyebrow}>[FIRMA] — producent palet drewnianych</p>
      <h1 className={styles.heroTitle}>
        Od deski
        <br />
        do ładunku.
      </h1>
      <p className={styles.heroLede}>
        Produkujemy palety stworzone do transportu, magazynowania i codziennej pracy.
      </p>
      <div className={styles.heroActions}>
        <a href="#proces" className="btn btn-primary">
          Zobacz proces
        </a>
        <a href="#produkty" className="btn btn-ghost">
          Poznaj ofertę
        </a>
      </div>
    </div>
  );
}

export function ScrollJourney(): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const can3D = useCanRender3D();
  const reducedMotion = useReducedMotion();
  const beat = useActiveBeat();
  const beatIndex = Math.max(0, BEATS.findIndex((item) => item.id === beat.id));
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || !can3D) return undefined;
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reducedMotion ? true : 0.35,
      onUpdate: (self) => setScrollProgress(self.progress),
    });
    return () => trigger.kill();
  }, [reducedMotion, can3D]);

  useEffect(() => subscribeScroll((t) => setProgress(Math.round(t * 100))), []);

  // The hero clears out of the way in the first few percent of the scroll, before beat 01 speaks.
  useEffect(() => {
    if (!can3D) return undefined;
    return subscribeScroll((t) => {
      const hero = heroRef.current;
      if (hero) {
        const fade = Math.min(1, Math.max(0, t / 0.045));
        hero.style.opacity = String(1 - fade);
        hero.style.transform = `translateY(${-fade * 40}px)`;
        hero.style.pointerEvents = fade > 0.5 ? 'none' : 'auto';
      }
      const caption = captionRef.current;
      if (caption) {
        // Beat captions wait for the hero to clear, so the two never speak over each other.
        caption.style.opacity = String(Math.min(1, Math.max(0, (t - 0.03) / 0.03)));
      }
    });
  }, [can3D]);

  // Nothing renders while the stage is off screen.
  useEffect(() => {
    const element = stickyRef.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver((entries) => setActive(entries[0].isIntersecting), {
      threshold: 0.01,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [can3D]);

  if (!can3D) {
    return (
      <section id="proces-3d" className={styles.flatWrapper} aria-label="Proces: od deski do ładunku">
        <Hero overlay={false} />
        <MobileFallback />
      </section>
    );
  }

  return (
    <section id="proces-3d" className={styles.wrapper} ref={wrapperRef} aria-label="Proces: od deski do ładunku">
      <div className={styles.sticky} ref={stickyRef}>
        <Suspense fallback={<div className={styles.loading} aria-hidden="true" />}>
          <JourneyCanvas active={active} />
        </Suspense>

        <div className={styles.overlay}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.heroSlot} ref={heroRef}>
            <Hero overlay />
          </div>

          <div className={styles.rail} aria-hidden="true">
            <p className={styles.railCount}>
              <span className={styles.railCurrent}>{String(beatIndex + 1).padStart(2, '0')}</span>
              <span className={styles.railTotal}>/ {String(BEATS.length).padStart(2, '0')}</span>
            </p>
            <span className={styles.railLine} />
            <ul className={styles.railDots}>
              {BEATS.map((item, index) => (
                <li key={item.id} className={index === beatIndex ? styles.railDotOn : undefined} />
              ))}
            </ul>
          </div>

          <div className={styles.captionSlot} ref={captionRef} style={{ opacity: 0 }}>
            <div className={styles.textBlock} key={beat.id}>
              <p className={styles.kicker}>{beat.kicker}</p>
              <h2 className={styles.line}>{beat.line}</h2>
              {beat.chips && (
                <ul className={styles.chips}>
                  {beat.chips.map((chip) => (
                    <li key={chip}>{chip}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
