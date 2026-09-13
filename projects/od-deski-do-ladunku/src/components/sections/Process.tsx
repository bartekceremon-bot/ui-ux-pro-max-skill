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

export function Process(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="proces" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <div className={`reveal ${styles.head}`}>
          <p className="eyebrow">Nasz proces</p>
          <h2>Siedem etapów, jedna linia</h2>
          <p className={`lede ${styles.headLede}`}>
            Od przyjęcia surowca po załadunek. Każdy etap ma swój moment kontroli.
          </p>
        </div>
        <ol className={styles.timeline}>
          {STEPS.map((step) => (
            <li key={step.n} className={`${styles.step} reveal`}>
              <span className={styles.stepNumber}>{step.n}</span>
              <div className={styles.stepBody}>
                <h3>{step.title}</h3>
              </div>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
