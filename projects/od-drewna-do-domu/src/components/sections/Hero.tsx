import styles from './Hero.module.css';

export function Hero(): JSX.Element {
  return (
    <section id="top" className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <p className={`eyebrow ${styles.eyebrow}`}>[FIRMA] — domy drewniane</p>
        <h1 className={styles.headline}>Od drewna do domu.</h1>
        <p className={`lede ${styles.lede}`}>Budujemy z materiału, który znamy od podstaw.</p>
        <div className={styles.actions}>
          <a href="#podroz" className="btn btn-primary">
            Zobacz, jak powstaje
          </a>
          <a href="#kontakt" className="btn btn-secondary">
            Porozmawiajmy
          </a>
        </div>
      </div>
      <a href="#podroz" className={styles.scrollCue} aria-label="Przewiń, aby zobaczyć proces">
        <span />
      </a>
    </section>
  );
}
