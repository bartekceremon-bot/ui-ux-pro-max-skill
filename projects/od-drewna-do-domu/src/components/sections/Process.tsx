import { useReveal } from '../../hooks/useReveal';
import { useCountUp } from '../../hooks/useCountUp';
import styles from './Process.module.css';

const STEPS = [
  { n: 1, title: 'Drewno', text: 'Wybór surowca — gatunek, wilgotność, przeznaczenie.' },
  { n: 2, title: 'Przecieranie', text: 'Kłoda trafia na trak. Powstaje deska i belka.' },
  { n: 3, title: 'Selekcja', text: 'Elementy sortowane według klasy i zastosowania.' },
  { n: 4, title: 'Obróbka', text: 'Strugowanie, docinanie, przygotowanie do montażu.' },
  { n: 5, title: 'Projekt', text: 'Konstrukcja domu dopasowana do działki i materiału.' },
  { n: 6, title: 'Konstrukcja', text: 'Rama, ściany, więźba — złożone z własnych elementów.' },
  { n: 7, title: 'Budowa', text: 'Montaż na miejscu, etap po etapie.' },
  { n: 8, title: 'Gotowy dom', text: 'Dom, który można nazwać swoim.' },
];

function StepRow({ n, title, text }: (typeof STEPS)[number]): JSX.Element {
  const countRef = useCountUp(n);
  return (
    <li className={`${styles.step} reveal`}>
      <span className={styles.number} ref={countRef}>
        00
      </span>
      <div>
        <h3 className={styles.stepTitle}>{title}</h3>
        <p className={styles.stepText}>{text}</p>
      </div>
    </li>
  );
}

export function Process(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="proces" className={styles.section}>
      <div className={`container ${styles.container}`} ref={ref}>
        <div className={`reveal ${styles.head}`}>
          <p className="eyebrow">Nasz proces</p>
          <h2>Osiem etapów, jeden wykonawca.</h2>
        </div>
        <ol className={styles.list}>
          {STEPS.map((step) => (
            <StepRow key={step.n} {...step} />
          ))}
        </ol>
      </div>
    </section>
  );
}
