import { useEffect, useState } from 'react';
import { useReveal } from '../../hooks/useReveal';
import styles from './Houses.module.css';

type Project = {
  id: string;
  name: string;
  location: string;
  area: string;
  type: string;
  gradient: string;
};

const PROJECTS: Project[] = [
  { id: '01', name: 'Dom nad rzeką', location: '[LOKALIZACJA]', area: '[METRAŻ] m²', type: 'Konstrukcja szkieletowa', gradient: 'linear-gradient(155deg,#5c6a4c,#c9a878)' },
  { id: '02', name: 'Dom na skraju lasu', location: '[LOKALIZACJA]', area: '[METRAŻ] m²', type: 'Konstrukcja bali', gradient: 'linear-gradient(155deg,#4a3524,#9c7a52)' },
  { id: '03', name: 'Dom jednorodzinny', location: '[LOKALIZACJA]', area: '[METRAŻ] m²', type: 'Konstrukcja szkieletowa', gradient: 'linear-gradient(155deg,#2a2723,#7a5a3a)' },
  { id: '04', name: 'Dom całoroczny', location: '[LOKALIZACJA]', area: '[METRAŻ] m²', type: 'Konstrukcja słupowo-ryglowa', gradient: 'linear-gradient(155deg,#3d3a34,#c9a878)' },
];

export function Houses(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const [active, setActive] = useState<Project | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <section id="domy" className={styles.section}>
      <div className={`container ${styles.head} reveal`}>
        <p className="eyebrow">Domy</p>
        <h2>Realizacje, nie wizualizacje.</h2>
      </div>
      <div ref={ref} className={`container ${styles.grid}`}>
        {PROJECTS.map((project) => (
          <button
            key={project.id}
            type="button"
            className={`${styles.card} reveal`}
            style={{ backgroundImage: project.gradient }}
            onClick={() => setActive(project)}
            aria-haspopup="dialog"
          >
            <span className={styles.cardNumber}>{project.id}</span>
            <span className={styles.cardMeta}>
              <strong>{project.name}</strong>
              <span>
                {project.location} · {project.area}
              </span>
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label={active.name} onClick={() => setActive(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={() => setActive(null)} aria-label="Zamknij">
              ×
            </button>
            <div className={styles.modalImage} style={{ backgroundImage: active.gradient }} />
            <h3>{active.name}</h3>
            <dl className={styles.modalFacts}>
              <div>
                <dt>Lokalizacja</dt>
                <dd>{active.location}</dd>
              </div>
              <div>
                <dt>Metraż</dt>
                <dd>{active.area}</dd>
              </div>
              <div>
                <dt>Konstrukcja</dt>
                <dd>{active.type}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
