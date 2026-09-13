import { useEffect, useRef } from 'react';
import { BEATS } from './journeyConfig';
import styles from './MobileFallback.module.css';

const GRADIENTS: Record<string, string> = {
  las: 'linear-gradient(160deg,#3f4d38,#5c6a4c 60%,#8b9a72)',
  drewno: 'linear-gradient(160deg,#4a3524,#6b4f34 55%,#c9a878)',
  przecieranie: 'linear-gradient(160deg,#2c2b28,#5a4632 55%,#cba36c)',
  obrobka: 'linear-gradient(160deg,#463726,#8f8574 55%,#d9c39c)',
  budowa: 'linear-gradient(160deg,#3d3226,#8f8b82 55%,#e2dccf)',
  dom: 'linear-gradient(160deg,#4a3a2a,#e6a95b 55%,#ffe3b3)',
};

/**
 * The brief is explicit: on mobile, do not force the heavy scene — replace it with a lighter
 * sequence but keep the story (DRZEWO → DREWNO → DOM) intact. Plain CSS reveals, no WebGL.
 */
export function MobileFallback(): JSX.Element {
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add(styles.visible);
        }
      },
      { threshold: 0.35 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.stack}>
      {BEATS.map((beat, i) => (
        <section
          key={beat.id}
          ref={(el) => (refs.current[i] = el)}
          className={styles.panel}
          style={{ backgroundImage: GRADIENTS[beat.id] }}
        >
          <p className={styles.kicker}>{beat.kicker}</p>
          <p className={styles.line}>{beat.line}</p>
        </section>
      ))}
    </div>
  );
}
