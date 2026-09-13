import { useReveal } from '../../hooks/useReveal';
import styles from './sections.module.css';

const PRODUCTS = [
  {
    index: '01',
    title: 'Palety standardowe',
    text: 'Powtarzalny wymiar do obiegu magazynowego i transportu drogowego.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
  },
  {
    index: '02',
    title: 'Palety przemysłowe',
    text: 'Wzmocniona konstrukcja pod cięższe i nietypowo rozłożone ładunki.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
  },
  {
    index: '03',
    title: 'Palety jednorazowe',
    text: 'Lżejsza konstrukcja do wysyłek w jedną stronę, bez obiegu zwrotnego.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
  },
  {
    index: '04',
    title: 'Palety niestandardowe',
    text: 'Zmieniony układ desek lub wysokość pod konkretne opakowanie.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
  },
  {
    index: '05',
    title: 'Palety na wymiar',
    text: 'Konstrukcja projektowana od zera pod gabaryt i masę ładunku klienta.',
    meta: 'Wycena indywidualna',
  },
  {
    index: '06',
    title: 'Elementy drewniane',
    text: 'Klocki, wsporniki i deski jako osobny asortyment do produkcji i napraw.',
    meta: '[ASORTYMENT]',
  },
];

export function Products(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="produkty" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <div className={`reveal ${styles.head}`}>
          <p className="eyebrow">Produkty</p>
          <h2>Co produkujemy</h2>
          <p className={`lede ${styles.headLede}`}>
            Wymiary i nośności podajemy po ustaleniu ładunku — nie ma jednej palety do wszystkiego.
          </p>
        </div>
        <div className={styles.cards}>
          {PRODUCTS.map((product) => (
            <article key={product.index} className={`${styles.card} reveal`}>
              <span className={styles.cardIndex}>{product.index}</span>
              <h3 className={styles.cardTitle}>{product.title}</h3>
              <p className={styles.cardText}>{product.text}</p>
              <p className={styles.cardMeta}>{product.meta}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
