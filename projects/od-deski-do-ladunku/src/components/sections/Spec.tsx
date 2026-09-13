import { Suspense, lazy } from 'react';
import { useReveal } from '../../hooks/useReveal';
import { useCanRender3D } from '../../hooks/usePreferences';
import { PARTS } from '../scene/builders/palletParts';
import { SectionHead } from './SectionHead';
import styles from './sections.module.css';
import specStyles from './Spec.module.css';

const SpecViewer = lazy(() => import('../scene/SpecViewer').then((m) => ({ default: m.SpecViewer })));

/** Grouped part counts, read off the same table the 3D model is built from. */
const GROUPS = [
  { kind: 'top', label: 'Deski górne' },
  { kind: 'stringer', label: 'Wsporniki nośne' },
  { kind: 'block', label: 'Klocki' },
  { kind: 'bottom', label: 'Deski dolne' },
].map((group) => ({ ...group, count: PARTS.filter((part) => part.kind === group.kind).length }));

export function Spec(): JSX.Element {
  const ref = useReveal<HTMLDivElement>();
  const can3D = useCanRender3D();

  return (
    <section id="specyfikacja" className={`section-light ${styles.section}`}>
      <div className="container" ref={ref}>
        <SectionHead
          index="05"
          kicker="Specyfikacja"
          title="Paleta rozłożona na części"
          lede={`Model odpowiada konstrukcji, którą produkujemy: ${PARTS.length} elementów i połączenia. Kliknij element, żeby zobaczyć jego rolę.`}
          aside={<p>Widok eksplodowany pokazuje kolejność montażu.</p>}
        />

        {can3D ? (
          <Suspense fallback={<div className={specStyles.placeholder} aria-hidden="true" />}>
            <SpecViewer />
          </Suspense>
        ) : (
          <ul className={specStyles.list}>
            {GROUPS.map((group) => (
              <li key={group.kind}>
                <span className={specStyles.listCount}>{String(group.count).padStart(2, '0')}</span>
                <span>{group.label}</span>
                <span className={specStyles.listMeta}>[WYMIAR] · [GATUNEK DREWNA]</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
