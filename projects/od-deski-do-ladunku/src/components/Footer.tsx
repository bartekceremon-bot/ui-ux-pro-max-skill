import styles from './Footer.module.css';

const COLUMNS = [
  {
    title: 'Oferta',
    links: [
      { href: '#produkty', label: 'Palety standardowe' },
      { href: '#produkty', label: 'Palety przemysłowe' },
      { href: '#produkty', label: 'Palety na wymiar' },
      { href: '#produkty', label: 'Elementy drewniane' },
    ],
  },
  {
    title: 'Firma',
    links: [
      { href: '#proces', label: 'Proces' },
      { href: '#produkcja', label: 'Produkcja' },
      { href: '#jakosc', label: 'Jakość' },
      { href: '#logistyka', label: 'Logistyka' },
    ],
  },
  {
    title: 'Informacje',
    links: [
      { href: '#specyfikacja', label: 'Specyfikacja' },
      { href: '#faq', label: 'FAQ' },
      { href: '#kontakt', label: 'Kontakt' },
    ],
  },
];

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <p className={styles.name}>[FIRMA]</p>
          <p className={styles.meta}>Producent palet drewnianych</p>
          <address className={styles.address}>
            [LOKALIZACJA]
            <br />
            [TELEFON]
            <br />
            [E-MAIL]
          </address>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} className={styles.column} aria-label={column.title}>
            <p className={styles.columnTitle}>{column.title}</p>
            <ul>
              {column.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={`container ${styles.bottom}`}>
        <p className={styles.meta}>© {new Date().getFullYear()} [FIRMA] · Wszelkie prawa zastrzeżone</p>
        <p className={styles.meta}>NIP [NIP] · Działa od [ROK ZAŁOŻENIA]</p>
      </div>
    </footer>
  );
}
