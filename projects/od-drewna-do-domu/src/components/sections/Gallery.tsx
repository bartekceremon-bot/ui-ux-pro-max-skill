import { useReveal } from '../../hooks/useReveal';
import styles from './Gallery.module.css';

const IMAGES = [
  'linear-gradient(155deg,#5c6a4c,#dfe6d6)',
  'linear-gradient(155deg,#4a3524,#c9a878)',
  'linear-gradient(155deg,#2c2b28,#8f8574)',
  'linear-gradient(155deg,#3d3226,#e2dccf)',
  'linear-gradient(155deg,#4a3a2a,#e6a95b)',
  'linear-gradient(155deg,#2a2723,#7a5a3a)',
];

export function Gallery(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="realizacje" className={styles.section}>
      <div className={`container reveal ${styles.head}`}>
        <p className="eyebrow">Realizacje</p>
        <h2>Zdjęcia mówią więcej niż specyfikacja.</h2>
      </div>
      <div ref={ref} className={`container ${styles.grid}`}>
        {IMAGES.map((gradient, i) => (
          <figure key={i} className={`${styles.item} reveal`} style={{ backgroundImage: gradient }}>
            <figcaption className="visually-hidden">Zdjęcie realizacji [NUMER] — do uzupełnienia</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
