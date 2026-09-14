import { useState, type FormEvent } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { IsoArt } from '../scene/IsoArt';
import styles from './sections.module.css';

const PALLET_TYPES = [
  'Palety standardowe',
  'Palety przemysłowe',
  'Palety jednorazowe',
  'Palety niestandardowe',
  'Palety na wymiar',
  'Elementy drewniane',
  'Nie wiem — proszę o dobór',
];

/**
 * A real inquiry form rather than a lone mailto button: for a pallet maker the first useful
 * question is always the same four things (typ, ilość, wymiary ładunku, termin), so the form
 * asks them. With no backend on a static build it hands the filled answers to the visitor's mail
 * client — swap the submit handler for an endpoint when there is one.
 */
export function Contact(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [sent, setSent] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    const body = [
      `Typ palety: ${value('typ')}`,
      `Ilość: ${value('ilosc')}`,
      `Wymiary ładunku: ${value('wymiary')}`,
      `Termin: ${value('termin')}`,
      `Firma: ${value('firma')}`,
      `E-mail: ${value('email')}`,
      `Telefon: ${value('telefon')}`,
      '',
      value('wiadomosc'),
    ].join('\n');
    window.location.href = `mailto:[E-MAIL]?subject=${encodeURIComponent('Zapytanie o palety')}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <section id="kontakt" className={styles.contact}>
      <div className={`container ${styles.contactGrid}`} ref={ref}>
        <div className="reveal">
          <p className="eyebrow">Kontakt</p>
          <h2 className={styles.contactHeading}>Potrzebujesz palet pod swój ładunek?</h2>
          <p className={`lede ${styles.contactLede}`}>
            Podaj wymiary ładunku i sposób transportu — dobierzemy typ palety i przygotujemy wycenę.
          </p>
          <ul className={styles.contactList}>
            <li>
              <span>TEL</span>[TELEFON]
            </li>
            <li>
              <span>MAIL</span>[E-MAIL]
            </li>
            <li>
              <span>ADRES</span>[LOKALIZACJA]
            </li>
            <li>
              <span>GODZ</span>[GODZINY PRACY]
            </li>
          </ul>

          {/* Closes the loop the page opened with: the finished, wrapped load. */}
          <div className={styles.contactArt}>
            <IsoArt beat="ladunek" />
          </div>
        </div>

        <form className={`${styles.form} reveal reveal-delay-1`} onSubmit={onSubmit}>
          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="typ">Typ palety</label>
              <select id="typ" name="typ" defaultValue={PALLET_TYPES[0]}>
                {PALLET_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="ilosc">Ilość (szt.)</label>
              <input id="ilosc" name="ilosc" inputMode="numeric" placeholder="np. 500" />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="wymiary">Wymiary ładunku</label>
              <input id="wymiary" name="wymiary" placeholder="dł. × szer. × wys." />
            </div>
            <div className={styles.field}>
              <label htmlFor="termin">Termin</label>
              <input id="termin" name="termin" placeholder="np. do 3 tygodni" />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="firma">Firma</label>
              <input id="firma" name="firma" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" required />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="telefon">Telefon (opcjonalnie)</label>
            <input id="telefon" name="telefon" type="tel" />
          </div>

          <div className={styles.field}>
            <label htmlFor="wiadomosc">Szczegóły</label>
            <textarea id="wiadomosc" name="wiadomosc" placeholder="Rodzaj towaru, sposób transportu, powtarzalność dostaw." />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary">
              Wyślij zapytanie
            </button>
            {sent && (
              <p className={styles.formStatus} role="status">
                Otwieramy Twój program pocztowy z gotową treścią.
              </p>
            )}
          </div>
          <p className={styles.formNote}>
            Formularz przygotowuje wiadomość w Twoim programie pocztowym. Do podpięcia pod skrzynkę lub CRM przed
            publikacją.
          </p>
        </form>
      </div>
    </section>
  );
}
