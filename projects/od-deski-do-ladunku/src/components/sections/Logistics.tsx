import { useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { SectionHead } from './SectionHead';
import styles from './sections.module.css';

const LINKS = [
  { id: 'paleta', stage: 'Krok 01', title: 'Paleta', summary: 'Gotowa konstrukcja odbierana z linii, opisana i odłożona na stos.' },
  { id: 'magazyn', stage: 'Krok 02', title: 'Magazyn', summary: 'Zapas trzymany pod bieżące zamówienia, sztaplowany według typu.' },
  { id: 'transport', stage: 'Krok 03', title: 'Transport', summary: 'Załadunek na zestaw i wysyłka pod wskazany adres.' },
  { id: 'klient', stage: 'Krok 04', title: 'Klient', summary: 'Rozładunek u odbiorcy i wejście palet do jego obiegu.' },
];

export function Logistics(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [activeId, setActiveId] = useState(LINKS[0].id);
  const active = LINKS.find((link) => link.id === activeId)!;

  return (
    <section id="logistyka" className={`section-dark ${styles.section}`}>
      <div className="container" ref={ref}>
        <SectionHead
          index="06"
          kicker="Logistyka"
          title="Droga palety"
          lede="Paleta → magazyn → transport → klient. Terminy i dostępność ustalamy przy zamówieniu."
          aside={<p>Zasięg dostaw: [ZASIĘG DOSTAW].</p>}
        />
        <div className={`${styles.chainLayout} ${styles.chainDark} reveal`}>
          <ul className={styles.chain}>
            {LINKS.map((link) => (
              <li key={link.id}>
                <button
                  type="button"
                  className={styles.chainButton}
                  aria-pressed={link.id === activeId}
                  onClick={() => setActiveId(link.id)}
                >
                  <span className={styles.chainStage}>{link.stage}</span>
                  <span className={styles.chainTitle}>{link.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.chainDetail} aria-live="polite">
            <p>{active.summary}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
