import { useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { PalletDiagram } from './PalletDiagram';
import { Shot } from '../scene/Shot';
import type { ShotVariant } from '../scene/ProductShot';
import styles from './sections.module.css';

type Product = {
  title: string;
  dims: string;
  text: string;
  boards: number[];
  dashed?: boolean;
  loose?: boolean;
  variant: ShotVariant;
};

const PRODUCTS: Product[] = [
  {
    title: 'Palety standardowe',
    dims: '[WYMIARY]',
    text: 'Powtarzalny wymiar do obiegu magazynowego i transportu drogowego.',
    boards: [1.45, 1, 1.45, 1, 1.45],
    variant: {},
  },
  {
    title: 'Palety przemysłowe',
    dims: '[WYMIARY] · [NOŚNOŚĆ]',
    text: 'Wzmocniona konstrukcja pod cięższe i nietypowo rozłożone ładunki.',
    boards: [1.6, 1.4, 1.6, 1.4, 1.6],
    variant: { deckScale: 1.5, blockScale: 1.18 },
  },
  {
    title: 'Palety jednorazowe',
    dims: '[WYMIARY]',
    text: 'Lżejsza konstrukcja do wysyłek w jedną stronę, bez obiegu zwrotnego.',
    boards: [1, 0.8, 1, 0.8],
    variant: { deckScale: 0.68, hidden: ['top-2', 'top-4'] },
  },
  {
    title: 'Palety niestandardowe',
    dims: '[WYMIARY]',
    text: 'Zmieniony układ desek lub wysokość pod konkretne opakowanie.',
    boards: [1.6, 0.7, 1, 1, 0.7, 1.6],
    variant: { hidden: ['top-3'], deckScale: 1.2 },
  },
  {
    title: 'Palety na wymiar',
    dims: 'Wycena indywidualna',
    text: 'Konstrukcja projektowana od zera pod gabaryt i masę ładunku klienta.',
    boards: [1.3, 1, 1.3, 1, 1.3],
    dashed: true,
    variant: { blockScale: 1.45 },
  },
  {
    title: 'Elementy drewniane',
    dims: '[ASORTYMENT]',
    text: 'Klocki, wsporniki i deski jako osobny asortyment do produkcji i napraw.',
    boards: [1.2, 1, 1.4],
    loose: true,
    variant: { hidden: ['top-1', 'top-2', 'top-3', 'top-4', 'top-5'] },
  },
];

const FEATURES = [
  { title: 'Trwałe konstrukcje', icon: 'shield' },
  { title: 'Różne wymiary', icon: 'frame' },
  { title: 'Możliwość personalizacji', icon: 'gear' },
] as const;

function FeatureIcon({ name }: { name: (typeof FEATURES)[number]['icon'] }): JSX.Element {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' as const };
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6z" {...common} />
      </svg>
    );
  }
  if (name === 'frame') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="1" {...common} />
        <path d="M4 9.5h16M8 5v14" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" {...common} />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" {...common} />
    </svg>
  );
}

export function Products(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const product = PRODUCTS[active];

  return (
    <section id="produkty" className={styles.offer}>
      <div className={styles.offerGrid} ref={ref}>
        <div className={`${styles.offerIntro} reveal`}>
          <p className="eyebrow">Nasza oferta</p>
          <h2 className={styles.offerTitle}>Rodzaje palet</h2>
          <p className={`lede ${styles.offerLede}`}>
            Oferujemy szeroki wybór palet drewnianych dopasowanych do różnych potrzeb i branż.
          </p>
          <a className="btn btn-ghost" href="#kontakt">
            Zapytaj o wycenę
          </a>

          <ul className={styles.features}>
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span className={styles.featureIcon}>
                  <FeatureIcon name={feature.icon} />
                </span>
                {feature.title}
              </li>
            ))}
          </ul>
        </div>

        <figure className={`${styles.offerStage} reveal reveal-delay-1`}>
          <Shot variant={product.variant} fallbackBeat="paleta" />
          <figcaption className={styles.offerCaption}>
            {product.title} — rysunek poglądowy. Układ pokładu ustalamy przy zamówieniu.
          </figcaption>
        </figure>

        <ul className={`${styles.typeList} reveal reveal-delay-2`}>
          {PRODUCTS.map((item, index) => (
            <li key={item.title}>
              <button
                type="button"
                className={index === active ? `${styles.typeRow} ${styles.typeRowOn}` : styles.typeRow}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
              >
                <span className={styles.typeThumb}>
                  <PalletDiagram boards={item.boards} dashed={item.dashed} loose={item.loose} />
                </span>
                <span className={styles.typeText}>
                  <span className={styles.typeName}>{item.title}</span>
                  <span className={styles.typeDims}>{item.dims}</span>
                </span>
                <span className={styles.typeArrow} aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className={`${styles.offerNote} reveal`}>{product.text}</p>
      </div>
    </section>
  );
}
