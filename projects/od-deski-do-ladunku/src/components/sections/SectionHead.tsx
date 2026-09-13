import styles from './sections.module.css';

type Props = {
  index: string;
  kicker: string;
  title: string;
  lede?: string;
  /** Optional right-hand column: a short note, a link, a meta list. */
  aside?: React.ReactNode;
};

/**
 * Every section opens the same way: a hairline rule, a numbered mono kicker, the title, and an
 * optional aside. Consistency here is what makes the page read as one document rather than as a
 * stack of blocks that each invented their own header.
 */
export function SectionHead({ index, kicker, title, lede, aside }: Props): JSX.Element {
  return (
    <header className={`${styles.head} reveal`}>
      <div className={styles.headMeta}>
        <span className={styles.headIndex}>{index}</span>
        <span className={styles.headKicker}>{kicker}</span>
      </div>
      <div className={styles.headMain}>
        <h2>{title}</h2>
        {lede && <p className={`lede ${styles.headLede}`}>{lede}</p>}
      </div>
      {aside && <div className={styles.headAside}>{aside}</div>}
    </header>
  );
}
