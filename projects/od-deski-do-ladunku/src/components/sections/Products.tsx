import { useReveal } from '../../hooks/useReveal';
import { SectionHead } from './SectionHead';
import { PalletDiagram } from './PalletDiagram';
import styles from './sections.module.css';

const PRODUCTS = [
  {
    index: '01',
    title: 'Palety standardowe',
    text: 'Powtarzalny wymiar do obiegu magazynowego i transportu drogowego.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
    boards: [1.45, 1, 1.45, 1, 1.45],
  },
  {
    index: '02',
    title: 'Palety przemysłowe',
    text: 'Wzmocniona konstrukcja pod cięższe i nietypowo rozłożone ładunki.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
    boards: [1.6, 1.4, 1.6, 1.4, 1.6],
  },
  {
    index: '03',
    title: 'Palety jednorazowe',
    text: 'Lżejsza konstrukcja do wysyłek w jedną stronę, bez obiegu zwrotnego.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
    boards: [1, 0.8, 1, 0.8],
  },
  {
    index: '04',
    title: 'Palety niestandardowe',
    text: 'Zmieniony układ desek lub wysokość pod konkretne opakowanie.',
    meta: '[WYMIARY] · [NOŚNOŚĆ]',
    boards: [1.6, 0.7, 1, 1, 0.7, 1.6],
  },
  {
    index: '05',
    title: 'Palety na wymiar',
    text: 'Konstrukcja projektowana od zera pod gabaryt i masę ładunku klienta.',
    meta: 'Wycena indywidualna',
    boards: [1.3, 1, 1.3, 1, 1.3],
    dashed: true,
  },
  {
    index: '06',
    title: 'Elementy drewniane',
    text: 'Klocki, wsporniki i deski jako osobny asortyment do produkcji i napraw.',
    meta: '[ASORTYMENT]',
    boards: [1.2, 1, 1.4],
    loose: true,
  },
];

export function Products(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="produkty" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <SectionHead
          index="02"
          kicker="Produkty"
          title="Co produkujemy"
          lede="Wymiary i nośności podajemy po ustaleniu ładunku — nie ma jednej palety do wszystkiego."
          aside={<p>Rysunki poglądowe. Układ pokładu ustalamy przy zamówieniu.</p>}
        />
        <div className={styles.cards}>
          {PRODUCTS.map((product) => (
            <article key={product.index} className={`${styles.card} reveal`}>
              <div className={styles.cardTop}>
                <span className={styles.cardIndex}>{product.index}</span>
                <span className={styles.cardDiagram}>
                  <PalletDiagram boards={product.boards} dashed={product.dashed} loose={product.loose} />
                </span>
              </div>
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
