import { useEffect, useRef } from 'react';
import { BEATS } from './journeyConfig';
import { IsoArt } from './IsoArt';
import styles from './MobileFallback.module.css';

/**
 * Phones get the story, not the scene: the same seven beats, drawn as isometric vector art, with
 * no WebGL and no three.js download at all. DREWNO -> PALETA -> TOWAR -> TRANSPORT still reads end
 * to end, and the reader can see the pallet being built rather than being told about it.
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
      { threshold: 0.25 },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <ol className={styles.stack}>
      {BEATS.map((beat, i) => (
        <li
          key={beat.id}
          ref={(element) => (refs.current[i] = element)}
          className={styles.panel}
        >
          <div className={styles.art}>
            <IsoArt beat={beat.id} />
          </div>
          <div className={styles.body}>
            {/* beat.kicker already carries its own index ("02 — DESKI"). */}
            <p className={styles.kicker}>{beat.kicker}</p>
            <p className={styles.line}>{beat.line}</p>
            {beat.chips && <p className={styles.chips}>{beat.chips.join(' · ')}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
