import { useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

const STEPS = [
  { n: '01', title: 'Drewno', text: 'Przyjęcie i segregacja surowca. Wilgotność i klasa decydują, gdzie trafi materiał.' },
  { n: '02', title: 'Przygotowanie', text: 'Cięcie na wymiar, struganie, przygotowanie elementów pod konkretny typ palety.' },
  { n: '03', title: 'Produkcja', text: 'Elementy trafiają na linię: deski pokładowe, wsporniki, klocki.' },
  { n: '04', title: 'Montaż', text: 'Zbijanie konstrukcji w ustalonej kolejności — od pokładu dolnego po górny.' },
  { n: '05', title: 'Kontrola', text: 'Sprawdzenie wymiarów, kompletności elementów i jakości połączeń.' },
  { n: '06', title: 'Gotowa paleta', text: 'Paleta odkładana na stos, opisana i przygotowana do wydania.' },
  { n: '07', title: 'Załadunek', text: 'Wydanie towaru i załadunek transportu.' },
];

/**
 * The horizontal production rail. It is the page's table of contents for the process: seven
 * numbered stops on one line, the way a plant lays out its own line. Each stop is a button, so
 * the rail is also the control for the detail underneath — the static version of this graphic
 * makes the reader guess what "Kontrola" means, this one answers it.
 */
export function Process(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section id="proces" className={styles.processBand}>
      <div className={`container ${styles.processInner}`} ref={ref}>
        <div className={`${styles.processIntro} reveal`}>
          <p className="eyebrow">Nasz proces</p>
          <h2 className={styles.processTitle}>
            Z drewna
            <br />
            powstaje paleta.
          </h2>
        </div>

        <div className={`${styles.processRailWrap} reveal reveal-delay-1`}>
          <ol className={styles.processRail}>
            {STEPS.map((item, index) => (
              <li key={item.n} className={styles.processStop}>
                <button
                  type="button"
                  className={index === active ? `${styles.stopButton} ${styles.stopOn}` : styles.stopButton}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  <span className={styles.stopDot}>{item.n}</span>
                  <span className={styles.stopLabel}>{item.title}</span>
                </button>
              </li>
            ))}
          </ol>

          <p className={styles.processDetail} aria-live="polite">
            <span className={styles.processDetailStep}>
              {step.n} — {step.title}
            </span>
            {step.text}
          </p>
        </div>
      </div>
    </section>
  );
}
