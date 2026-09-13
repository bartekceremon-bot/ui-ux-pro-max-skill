import { useReveal } from '../../hooks/useReveal';
import styles from './About.module.css';

const PARAGRAPHS = [
  'Zanim deska trafi na budowę, przechodzi przez nasz tartak. Znamy jej słoje, wilgotność i kierunek pracy — bo sami ją przetarliśmy.',
  'Nie kupujemy gotowych elementów od podwykonawców. Surowiec, przecieranie, obróbka i montaż zostają w jednych rękach — naszych.',
  'To oznacza mniej niewiadomych na budowie i jasną odpowiedzialność: za materiał odpowiadamy od kłody, nie dopiero od paczki z hurtowni.',
];

export function About(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="o-firmie" className={styles.section}>
      <div ref={ref} className={`container ${styles.grid}`}>
        <div className="reveal">
          <p className="eyebrow">O firmie</p>
          <h2 className={styles.heading}>Kontrolujemy materiał od pierwszego cięcia.</h2>
        </div>
        <div className={styles.copy}>
          {PARAGRAPHS.map((text, i) => (
            <p key={text} className={`reveal reveal-delay-${Math.min(i + 1, 3)} ${styles.paragraph}`}>
              {text}
            </p>
          ))}
          <p className={`reveal reveal-delay-3 ${styles.founded}`}>Działamy od [ROK ZAŁOŻENIA] w [LOKALIZACJA].</p>
        </div>
      </div>
    </section>
  );
}
