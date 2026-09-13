import { useReveal } from '../../hooks/useReveal';
import styles from './Technology.module.css';

const CHAIN = ['Las', 'Kłoda', 'Tartak', 'Element', 'Dom'];

export function Technology(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className={styles.section}>
      <div ref={ref} className="container">
        <div className="reveal">
          <p className="eyebrow" style={{ color: 'var(--color-wood-light)' }}>
            Technologia
          </p>
          <h2 className={styles.heading}>Nie kupujemy gotowego rozwiązania. Kontrolujemy materiał od początku.</h2>
        </div>
        <ol className={`reveal ${styles.chain}`}>
          {CHAIN.map((step, i) => (
            <li key={step} className={styles.chainItem}>
              <span>{step}</span>
              {i < CHAIN.length - 1 && <span className={styles.arrow} aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
