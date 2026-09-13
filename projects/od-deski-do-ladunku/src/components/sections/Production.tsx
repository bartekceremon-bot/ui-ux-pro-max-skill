import { useReveal } from '../../hooks/useReveal';
import { SectionHead } from './SectionHead';
import styles from './sections.module.css';

const SLOTS = [
  { label: 'Hala produkcyjna', hint: 'Ujęcie szerokie, pokazujące skalę' },
  { label: 'Maszyny', hint: 'Trak, piła, gwoździarka' },
  { label: 'Surowiec', hint: 'Stos tarcicy przed cięciem' },
  { label: 'Montaż', hint: 'Stanowisko zbijania palet' },
  { label: 'Gotowy towar', hint: 'Sztaplowane palety przed wydaniem' },
];

export function Production(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="produkcja" className={`section-dark ${styles.section}`}>
      <div className="container" ref={ref}>
        <SectionHead
          index="03"
          kicker="Produkcja"
          title="Zaplecze"
          lede="Miejsce na zdjęcia z hali. Podmieniamy je na materiał [FIRMA] przed publikacją."
          aside={<p>Zalecany format: poziomy, min. 1600 px szerokości.</p>}
        />
        <div className={styles.photoGrid}>
          {SLOTS.map((slot) => (
            <figure key={slot.label} className={`${styles.photoSlot} reveal`}>
              <figcaption className={styles.photoLabel}>{slot.label}</figcaption>
              <p className={styles.photoHint}>{slot.hint}</p>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
