import styles from './Footer.module.css';

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <p className={styles.name}>[FIRMA]</p>
          <p className={styles.meta}>Producent palet drewnianych · [LOKALIZACJA] · od [ROK ZAŁOŻENIA]</p>
        </div>
        <p className={styles.meta}>
          [TELEFON] · [E-MAIL]
        </p>
        <p className={styles.meta}>© {new Date().getFullYear()} [FIRMA]</p>
      </div>
    </footer>
  );
}
