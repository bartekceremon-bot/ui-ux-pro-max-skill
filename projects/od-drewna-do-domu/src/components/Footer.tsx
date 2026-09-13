import styles from './Footer.module.css';

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>[FIRMA] · [LOKALIZACJA] · [E-MAIL] · [TELEFON]</p>
        <p className={styles.legal}>© {new Date().getFullYear()} [FIRMA]. Wszelkie prawa zastrzeżone.</p>
      </div>
    </footer>
  );
}
