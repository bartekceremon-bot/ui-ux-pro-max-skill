import { useEffect, useRef } from 'react';
import { BEATS } from './journeyConfig';
import styles from './MobileFallback.module.css';

/**
 * Phones get the story, not the scene: the same seven beats as flat panels, no WebGL and no
 * three.js download at all. DREWNO -> PALETA -> TOWAR -> TRANSPORT still reads end to end.
 */
const ART: Record<string, string> = {
  drewno: 'linear-gradient(155deg,#2a2420,#6d4a27 60%,#a98456)',
  deski: 'linear-gradient(155deg,#31291f,#a9814f 60%,#dcb383)',
  elementy: 'linear-gradient(155deg,#241f1b,#7a5b36 55%,#c39a63)',
  montaz: 'linear-gradient(155deg,#1d1b18,#5f6b4a 55%,#b8834a)',
  paleta: 'linear-gradient(155deg,#211f1c,#b8834a 65%,#e3c79b)',
  towar: 'linear-gradient(155deg,#1e1c19,#8a6a45 55%,#b98c5c)',
  ladunek: 'linear-gradient(155deg,#171614,#3f4a54 55%,#8d9298)',
};

export function MobileFallback(): JSX.Element {
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add(styles.visible);
        }
      },
      { threshold: 0.3 },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.stack}>
      {BEATS.map((beat, i) => (
        <section
          key={beat.id}
          ref={(element) => (refs.current[i] = element)}
          className={styles.panel}
          style={{ backgroundImage: ART[beat.id] }}
        >
          <p className={styles.kicker}>{beat.kicker}</p>
          <p className={styles.line}>{beat.line}</p>
          {beat.chips && <p className={styles.chips}>{beat.chips.join(' · ')}</p>}
        </section>
      ))}
    </div>
  );
}
