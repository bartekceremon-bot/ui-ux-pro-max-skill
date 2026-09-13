import { useReveal } from '../../hooks/useReveal';
import styles from './CTA.module.css';

export function CTA(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="kontakt" className={styles.section}>
      <div ref={ref} className={`container ${styles.inner}`}>
        <h2 className={`reveal ${styles.heading}`}>Masz działkę. My mamy drewno i doświadczenie.</h2>
        <div className={`reveal reveal-delay-1 ${styles.actions}`}>
          <a href="mailto:[E-MAIL]" className="btn btn-primary">
            Porozmawiajmy o projekcie
          </a>
          <a href="tel:[TELEFON]" className={styles.phone}>
            [TELEFON]
          </a>
        </div>
      </div>
    </section>
  );
}
