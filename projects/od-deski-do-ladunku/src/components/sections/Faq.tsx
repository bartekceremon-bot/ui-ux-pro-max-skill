import { useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { SectionHead } from './SectionHead';
import styles from './sections.module.css';

const ITEMS = [
  {
    q: 'Jakie wymiary palet produkujecie?',
    a: 'Produkujemy wymiary standardowe oraz palety na wymiar. Konkretne wymiary i nośności: [WYMIARY PALET], [NOŚNOŚĆ]. Przy nietypowym ładunku dobieramy konstrukcję indywidualnie.',
  },
  {
    q: 'Jaka jest minimalna wielkość zamówienia?',
    a: 'Minimum logistyczne to [MINIMALNE ZAMÓWIENIE]. Przy mniejszych ilościach ustalamy warunki indywidualnie.',
  },
  {
    q: 'Ile trwa realizacja?',
    a: 'Termin zależy od typu palety i wielkości zamówienia: [TERMIN REALIZACJI]. Przy powtarzalnych dostawach ustalamy harmonogram.',
  },
  {
    q: 'Czy palety są suszone lub poddawane obróbce termicznej?',
    a: 'Zakres obróbki i ewentualne oznaczenia fitosanitarne: [OBRÓBKA / OZNACZENIA]. Uzupełniamy zgodnie ze stanem faktycznym w zakładzie.',
  },
  {
    q: 'Czy dostarczacie towar do klienta?',
    a: 'Tak, obszar dostaw to [ZASIĘG DOSTAW]. Możliwy jest też odbiór własny z [LOKALIZACJA].',
  },
  {
    q: 'Czy produkujecie same elementy, bez montażu?',
    a: 'Tak. Klocki, wsporniki i deski sprzedajemy również jako osobny asortyment — do produkcji i do napraw palet.',
  },
];

export function Faq(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <SectionHead
          index="07"
          kicker="FAQ"
          title="Najczęstsze pytania"
          lede="Odpowiedzi na to, o co pytają klienci przy pierwszym kontakcie."
        />
        <div className={`${styles.faqLayout} reveal`}>
          <div className={styles.faq}>
          {ITEMS.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.q} className={styles.faqItem}>
                <h3>
                  <button
                    type="button"
                    className={styles.faqButton}
                    aria-expanded={open}
                    aria-controls={`faq-${index}`}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    {item.q}
                    <span className={styles.faqSign} aria-hidden="true">
                      +
                    </span>
                  </button>
                </h3>
                <div id={`faq-${index}`} hidden={!open}>
                  <p className={styles.faqAnswer}>{item.a}</p>
                </div>
              </div>
            );
          })}
          </div>

          <aside className={styles.faqAside}>
            <p className="eyebrow">Nie ma Twojego pytania?</p>
            <p className={styles.faqAsideTitle}>Napisz, co wozisz</p>
            <p className={styles.faqAsideText}>
              Najszybciej odpowiemy, jeśli podasz wymiary ładunku, masę i sposób transportu.
            </p>
            <a className="btn btn-ghost" href="#kontakt">
              Zadaj pytanie
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
