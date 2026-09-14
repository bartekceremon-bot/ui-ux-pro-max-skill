import { lazy, Suspense } from 'react';
import { IsoArt } from './IsoArt';
import { useCanRender3D } from '../../hooks/usePreferences';
import type { ShotSubject, ShotVariant } from './ProductShot';
import styles from './Shot.module.css';

const ProductShot = lazy(() => import('./ProductShot').then((m) => ({ default: m.ProductShot })));

type Props = {
  subject?: ShotSubject;
  variant?: ShotVariant;
  /** Which isometric beat stands in for this shot where WebGL is not used. */
  fallbackBeat: string;
};

/**
 * A product render, or the vector drawing of the same thing.
 *
 * The journey already refuses to start WebGL on phones; adding two more canvases further down
 * the page would quietly undo that. Below the 3D bar these sections get the isometric art the
 * mobile story is drawn in, which costs a few hundred bytes of SVG and no GPU at all.
 */
export function Shot({ subject = 'pallet', variant = {}, fallbackBeat }: Props): JSX.Element {
  const can3D = useCanRender3D();

  if (!can3D) {
    return (
      <div className={styles.flat}>
        <IsoArt beat={fallbackBeat} />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className={styles.flat} aria-hidden="true" />}>
      <ProductShot subject={subject} variant={variant} />
    </Suspense>
  );
}
