import { useEffect, useState } from 'react';
import { LogoMark } from './LogoMark';
import styles from './Nav.module.css';

const LINKS = [
  { id: 'top', label: 'Strona główna' },
  { id: 'produkty', label: 'Oferta' },
  { id: 'proces', label: 'Proces produkcji' },
  { id: 'specyfikacja', label: 'Specyfikacja' },
  { id: 'jakosc', label: 'Jakość' },
  { id: 'kontakt', label: 'Kontakt' },
];

export function Nav(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>('top');

  // Which section the reader is in: the last one whose top has passed reading height.
  //
  // An IntersectionObserver was wrong here. Its callback only reports the entries that *changed*,
  // so picking the first intersecting entry out of one batch can leave a section highlighted long
  // after the reader has left it. Measuring the live rects on scroll is both simpler and exact.
  useEffect(() => {
    // Sorted by position in the page, not by position in the nav: the two differ, and "the last
    // section the reader has passed" is only meaningful in document order.
    const sections = LINKS.map((link) => document.getElementById(link.id))
      .filter((element): element is HTMLElement => Boolean(element))
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (sections.length === 0) return undefined;

    let queued = false;
    const measure = () => {
      queued = false;
      const line = window.innerHeight * 0.32;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section;
      }
      setActiveId(current.id);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
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
        <div className={styles.inner}>
          <a href="#top" className={styles.logo}>
            <LogoMark />
            <span className={styles.logoDivider} aria-hidden="true" />
            <span className={styles.logoText}>
              <span className={styles.logoName}>[FIRMA]</span>
              <span className={styles.logoMeta}>Drewno · Logistyka · Transport</span>
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
            <a href="tel:" className={styles.phone}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
                <path
                  d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.6a1 1 0 0 1-.25 1z"
                  fill="currentColor"
                />
              </svg>
              [TELEFON]
            </a>
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
      <div id="menu-mobilne" className={styles.drawer} hidden={!open}>
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
