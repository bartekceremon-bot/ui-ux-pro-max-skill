import { useReveal } from '../../hooks/useReveal';
import { SectionHead } from './SectionHead';
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
        <SectionHead
          index="01"
          kicker="Nasz proces"
          title="Siedem etapów, jedna linia"
          lede="Od przyjęcia surowca po załadunek. Każdy etap ma swój moment kontroli."
          aside={<p>Terminy realizacji zależą od typu palety i wielkości zamówienia.</p>}
        />
        <ol className={styles.timeline}>
          {STEPS.map((step) => (
            <li key={step.n} className={`${styles.step} reveal`}>
              <span className={styles.stepNumber}>{step.n}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
