import { useEffect, useState } from 'react';
import styles from './Nav.module.css';

const LINKS = [
  { id: 'proces', label: 'Proces' },
  { id: 'produkty', label: 'Produkty' },
  { id: 'produkcja', label: 'Produkcja' },
  { id: 'specyfikacja', label: 'Specyfikacja' },
  { id: 'logistyka', label: 'Logistyka' },
  { id: 'faq', label: 'FAQ' },
];

export function Nav(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Which section the reader is in. rootMargin biases the "current" band to the upper third,
  // so a heading counts as active once it reaches reading height, not when it barely peeks in.
  useEffect(() => {
    const sections = LINKS.map((link) => document.getElementById(link.id)).filter(
      (element): element is HTMLElement => Boolean(element),
    );
    if (sections.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -68% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // The drawer is a modal surface: Escape closes it and the page underneath stops scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className={styles.header}>
        <div className={`container ${styles.inner}`}>
          <a href="#top" className={styles.logo}>
            <span className={styles.logoMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className={styles.logoText}>
              [FIRMA]
              <span className={styles.logoMeta}>Palety drewniane</span>
            </span>
          </a>

          <nav className={styles.nav} aria-label="Nawigacja główna">
            {LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={activeId === link.id ? 'true' : undefined}
                className={styles.navLink}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.actions}>
            <a href="#kontakt" className={styles.cta}>
              Zapytaj o ofertę
            </a>
            <button
              type="button"
              className={styles.burger}
              aria-expanded={open}
              aria-controls="menu-mobilne"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="visually-hidden">{open ? 'Zamknij menu' : 'Otwórz menu'}</span>
              <span className={open ? `${styles.burgerBars} ${styles.burgerOpen}` : styles.burgerBars} aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* The header carries `backdrop-filter`, which makes it the containing block for any
          fixed-position descendant -- a drawer nested inside it collapses to the header's own
          height. It lives as a sibling so `inset` resolves against the viewport. */}
      <div id="menu-mobilne" className={open ? `${styles.drawer} ${styles.drawerOpen}` : styles.drawer} hidden={!open}>
        <nav aria-label="Nawigacja mobilna" className={styles.drawerNav}>
          {LINKS.map((link, index) => (
            <a key={link.id} href={`#${link.id}`} onClick={() => setOpen(false)}>
              <span className={styles.drawerIndex}>{String(index + 1).padStart(2, '0')}</span>
              {link.label}
            </a>
          ))}
        </nav>
        <a href="#kontakt" className="btn btn-primary" onClick={() => setOpen(false)}>
          Zapytaj o ofertę
        </a>
        <p className={styles.drawerContact}>[TELEFON] · [E-MAIL]</p>
      </div>
    </>
  );
}
