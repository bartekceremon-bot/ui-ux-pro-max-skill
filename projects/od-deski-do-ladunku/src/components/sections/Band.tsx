import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

/**
 * The band right under the 3D stage. Values that are facts about how the company works are
 * written out; anything that would be a number we do not have stays a bracket, because a made-up
 * "500 palet dziennie" is worse than an obvious blank.
 */
const ITEMS = [
  { value: 'Własna produkcja', label: 'Od surowca po gotową paletę' },
  { value: '[LICZBA]', label: 'Palet dziennie' },
  { value: 'Na wymiar', label: 'Konstrukcja pod ładunek klienta' },
  { value: '[ZASIĘG]', label: 'Obszar dostaw' },
];

export function Band(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className={styles.band} aria-label="Wyróżniki">
      <div className="container" ref={ref}>
        <div className={styles.bandGrid}>
          {ITEMS.map((item) => (
            <div key={item.label} className={`${styles.bandItem} reveal`}>
              <span className={styles.bandValue}>{item.value}</span>
              <span className={styles.bandLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
