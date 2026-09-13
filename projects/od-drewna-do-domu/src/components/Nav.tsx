import styles from './Nav.module.css';

const LINKS = [
  { href: '#o-firmie', label: 'O firmie' },
  { href: '#proces', label: 'Proces' },
  { href: '#domy', label: 'Domy' },
  { href: '#tartak', label: 'Tartak' },
  { href: '#realizacje', label: 'Realizacje' },
];

export function Nav(): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.logo}>
          [FIRMA]
        </a>
        <nav className={styles.nav} aria-label="Nawigacja główna">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a href="#kontakt" className={`btn btn-secondary ${styles.cta}`}>
          Porozmawiajmy
        </a>
      </div>
    </header>
  );
}
