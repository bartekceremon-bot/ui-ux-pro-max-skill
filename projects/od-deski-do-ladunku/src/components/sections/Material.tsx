import { useReveal } from '../../hooks/useReveal';
import { Shot } from '../scene/Shot';
import styles from './sections.module.css';

/**
 * The material chapter. It used to be the first two beats of the scroll story, where it flashed
 * past in half a screen; as its own split section a reader can actually stop on it.
 *
 * The left panel is a render of our own sawn stock rather than stock photography — the site
 * shows nothing it cannot account for, and a bought photo of somebody else's timber yard would
 * be exactly the kind of invented fact the brief rules out.
 */
const POINTS = [
  { n: '01', title: 'Drewno', text: 'Przyjęcie i segregacja surowca. Wilgotność i klasa decydują, gdzie trafi materiał.' },
  { n: '02', title: 'Deski', text: 'Cięcie na wymiar i struganie. Z jednej belki powstaje komplet elementów.' },
];

export function Material(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="material" className={styles.material} aria-labelledby="material-title">
      <div className={styles.materialGrid} ref={ref}>
        <div className={styles.materialStage}>
          <Shot subject="timber" fallbackBeat="drewno" />
        </div>

        <div className={`${styles.materialBody} reveal`}>
          <p className="eyebrow">Nasz materiał</p>
          <h2 id="material-title" className={styles.materialTitle}>
            Solidne podstawy
            <br />
            to dobre drewno.
          </h2>
          <p className={`lede ${styles.materialLede}`}>
            Klasa i wilgotność surowca decydują o tym, ile paleta wytrzyma. Dlatego materiał
            segregujemy przed cięciem, a nie po.
          </p>

          <ol className={styles.materialPoints}>
            {POINTS.map((point) => (
              <li key={point.n}>
                <span className={styles.materialPointIndex}>{point.n}</span>
                <span>
                  <strong>{point.title}</strong>
                  {point.text}
                </span>
              </li>
            ))}
          </ol>

          <a className="btn btn-primary" href="#jakosc">
            Zobacz kontrolę jakości
          </a>
        </div>
      </div>
    </section>
  );
}
