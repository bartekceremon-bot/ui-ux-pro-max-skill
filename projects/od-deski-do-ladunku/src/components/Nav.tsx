import styles from './Nav.module.css';

const LINKS = [
  { href: '#proces', label: 'Proces' },
  { href: '#produkty', label: 'Produkty' },
  { href: '#produkcja', label: 'Produkcja' },
  { href: '#specyfikacja', label: 'Specyfikacja' },
  { href: '#logistyka', label: 'Logistyka' },
];

export function Nav(): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.logo}>
          [FIRMA]
          <span className={styles.logoMeta}>Palety drewniane</span>
        </a>
        <nav className={styles.nav} aria-label="Nawigacja główna">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a href="#kontakt" className={styles.cta}>
          Zapytaj o ofertę
        </a>
      </div>
    </header>
  );
}
