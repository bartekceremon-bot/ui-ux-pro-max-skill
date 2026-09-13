import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

const SLOTS = [
  'Zdjęcie — hala produkcyjna',
  'Zdjęcie — maszyny',
  'Zdjęcie — surowiec',
  'Zdjęcie — gotowe palety',
  'Zdjęcie — montaż',
];

export function Production(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="produkcja" className={`section-dark ${styles.section}`}>
      <div className="container" ref={ref}>
        <div className={`reveal ${styles.head}`}>
          <p className="eyebrow">Produkcja</p>
          <h2>Zaplecze</h2>
          <p className={`lede ${styles.headLede}`}>
            Miejsce na zdjęcia z hali: maszyny, surowiec, montaż i gotowy towar. Do uzupełnienia
            materiałem [FIRMA].
          </p>
        </div>
        <div className={styles.photoGrid}>
          {SLOTS.map((slot) => (
            <div key={slot} className={`${styles.photoSlot} reveal`}>
              <span>{slot}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
