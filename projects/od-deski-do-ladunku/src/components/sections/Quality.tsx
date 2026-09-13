import { useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

const STAGES = [
  {
    id: 'material',
    stage: 'Etap 01',
    title: 'Materiał',
    checks: ['Klasa i wilgotność surowca', 'Odrzut elementów z wadami', 'Podział materiału wg typu palety'],
    summary: 'Zanim cokolwiek trafi na linię, materiał jest posortowany.',
  },
  {
    id: 'produkcja',
    stage: 'Etap 02',
    title: 'Produkcja',
    checks: ['Wymiar elementów po cięciu', 'Powtarzalność serii', 'Stan narzędzi na stanowisku'],
    summary: 'Elementy powstają w powtarzalnym wymiarze — od tego zależy cała reszta.',
  },
  {
    id: 'kontrola',
    stage: 'Etap 03',
    title: 'Kontrola',
    checks: ['Kompletność elementów', 'Rozstaw desek i kieszeni na widły', 'Jakość połączeń'],
    summary: 'Paleta jest sprawdzana jako konstrukcja, nie jako stos desek.',
  },
  {
    id: 'produkt',
    stage: 'Etap 04',
    title: 'Gotowy produkt',
    checks: ['Oznaczenie partii', 'Sposób sztaplowania', 'Przygotowanie do wydania'],
    summary: 'Towar wychodzi opisany i ułożony tak, jak ma dojechać.',
  },
];

export function Quality(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [activeId, setActiveId] = useState(STAGES[0].id);
  const active = STAGES.find((stage) => stage.id === activeId)!;

  return (
    <section id="jakosc" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <div className={`reveal ${styles.head}`}>
          <p className="eyebrow">Jakość</p>
          <h2>Cztery punkty kontroli</h2>
          <p className={`lede ${styles.headLede}`}>
            Materiał → produkcja → kontrola → gotowy produkt. Wybierz etap, żeby zobaczyć, co jest sprawdzane.
          </p>
        </div>

        <ul className={`${styles.chain} reveal`}>
          {STAGES.map((stage) => (
            <li key={stage.id} className={styles.chainItem}>
              <button
                type="button"
                className={styles.chainButton}
                aria-pressed={stage.id === activeId}
                onClick={() => setActiveId(stage.id)}
              >
                <span className={styles.chainStage}>{stage.stage}</span>
                <span className={styles.chainTitle}>{stage.title}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.chainDetail} aria-live="polite">
          <p>{active.summary}</p>
          <ul>
            {active.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
