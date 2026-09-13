import { useReveal } from '../../hooks/useReveal';
import styles from './Sawmill.module.css';

const SPECIES = ['[GATUNEK DREWNA 1]', '[GATUNEK DREWNA 2]', '[GATUNEK DREWNA 3]', '[GATUNEK DREWNA 4]'];

export function Sawmill(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="tartak" className={styles.section}>
      <div ref={ref} className={`container ${styles.grid}`}>
        <div className={styles.visual} aria-hidden="true">
          <div className={styles.visualPanel} />
        </div>
        <div className={`reveal ${styles.copy}`}>
          <p className="eyebrow">Tartak i drewno</p>
          <h2 className={styles.heading}>Zaplecze, które widać w gotowym domu.</h2>
          <p className={styles.paragraph}>
            Przecieramy kłody na własnym traku, sortujemy według klasy wytrzymałościowej i sezonujemy przed obróbką. To, co
            trafia na budowę, przeszło przez nasze ręce od początku.
          </p>
          <ul className={styles.species}>
            {SPECIES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className={styles.note}>Możliwości obróbki: [ZAKRES OBRÓBKI — np. strugowanie, impregnacja, cięcie na wymiar].</p>
        </div>
      </div>
    </section>
  );
}
