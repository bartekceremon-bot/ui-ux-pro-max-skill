import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

export function CTA(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="kontakt" className={styles.cta}>
      <div className={`container ${styles.ctaInner}`} ref={ref}>
        <h2 className={`reveal ${styles.ctaHeading}`}>Potrzebujesz palet do swojego transportu?</h2>
        <p className={`reveal reveal-delay-1 lede`} style={{ textAlign: 'center' }}>
          Podaj wymiary ładunku i sposób transportu — dobierzemy typ palety i przygotujemy wycenę.
        </p>
        <div className={`reveal reveal-delay-2 ${styles.ctaActions}`}>
          <a className="btn btn-primary" href="mailto:[E-MAIL]">
            Skontaktuj się z nami
          </a>
          <a className="btn btn-ghost" href="#produkty">
            Poznaj naszą ofertę
          </a>
        </div>
        <p className={`reveal reveal-delay-3 ${styles.ctaContact}`}>[TELEFON] · [E-MAIL] · [LOKALIZACJA]</p>
      </div>
    </section>
  );
}
