/**
 * Calibration dataset -> Ultralytics YOLO format (ZIP).
 *
 *   images/{train,val}/*.jpg
 *   labels/{train,val}/*.txt   "cls x1 y1 x2 y1 x2 y2 x1 y2" (normalised rectangle polygons;
 *                               valid for both detection and segmentation training)
 *   data.yaml
 */
import { zipSync, strToU8 } from 'fflate';
import type { Sample } from './store';

export async function buildDatasetZip(list: Sample[], valFrac = 0.15): Promise<{ zip: Blob; classes: string[] }> {
  const classes = [...new Set(list.map((s) => s.className))].sort();
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    // deterministic split: roughly every 7th image goes to validation
    const split = list.length > 1 && (i % Math.max(2, Math.round(1 / valFrac)) === 1) ? 'val' : 'train';
    const name = `oc_${String(s.id ?? i).padStart(5, '0')}`;
    files[`images/${split}/${name}.jpg`] = new Uint8Array(await s.image.arrayBuffer());
    const c = classes.indexOf(s.className);
    const lines = s.boxes.map(([x1, y1, x2, y2]) => {
      const nx1 = Math.max(0, x1 / s.w), ny1 = Math.max(0, y1 / s.h), nx2 = Math.min(1, x2 / s.w), ny2 = Math.min(1, y2 / s.h);
      return `${c} ${[nx1, ny1, nx2, ny1, nx2, ny2, nx1, ny2].map((v) => v.toFixed(6)).join(' ')}`;
    });
    files[`labels/${split}/${name}.txt`] = strToU8(lines.join('\n'));
  }
  const yaml = `# exported from Licznik Obiektów\npath: .\ntrain: images/train\nval: images/val\nnames:\n${classes.map((c, i) => `  ${i}: ${c}`).join('\n')}\n`;
  files['data.yaml'] = strToU8(yaml);
  const zipped = zipSync(files, { level: 0 }); // JPEGs don't compress
  return { zip: new Blob([zipped as BlobPart], { type: 'application/zip' }), classes };
}
