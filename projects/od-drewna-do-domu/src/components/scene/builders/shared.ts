import * as THREE from 'three';

/** Flat ground disc, shared by every set so the corridor reads as one continuous walk. */
export function groundPatch(radius: number, color: string, z: number, roughness = 0.95): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 40);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, z);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Rectangular ground, bounded on purpose: every set sits at y = 0, so a disc generous enough to
 * cover its own content easily reaches into the neighbouring set's territory and the two
 * coplanar patches z-fight where they overlap. A width/depth rectangle sized to each set's own
 * footprint (plus the corridor dividers) avoids that instead of papering over it with more fog.
 */
export function groundRect(width: number, depth: number, color: string, centerZ: number, roughness = 0.95): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, centerZ);
  mesh.receiveShadow = true;
  return mesh;
}

export function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Procedural growth-ring texture for a log's cut face — painted, not imported. */
export function ringTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d9b98a';
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const rings = 26;
  for (let i = rings; i > 0; i--) {
    const r = (i / rings) * (size / 2 - 6);
    const wobble = 1 + Math.sin(i * 1.7) * 0.015;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * wobble, r, 0, 0, Math.PI * 2);
    const dark = i % 2 === 0;
    ctx.strokeStyle = dark ? 'rgba(107,79,52,0.55)' : 'rgba(201,168,120,0.5)';
    ctx.lineWidth = dark ? 2.4 : 5;
    ctx.stroke();
  }
  // hairline radial checks
  for (let a = 0; a < 10; a++) {
    const angle = (a / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * size * 0.48, cy + Math.sin(angle) * size * 0.48);
    ctx.strokeStyle = 'rgba(74,53,36,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type Hoverable = {
  object: THREE.Object3D;
  label: string;
  info: string;
};
