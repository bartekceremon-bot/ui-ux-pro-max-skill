import * as THREE from 'three';

/** Reusable 2D canvas at a fixed size — every procedural texture in the scene is painted here. */
function canvas(width: number, height: number) {
  const element = Object.assign(document.createElement('canvas'), { width, height });
  return { element, ctx: element.getContext('2d')! };
}

function finish(element: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

/** Sawn softwood face: long grain lines running the length of the board, plus a couple of knots. */
export function woodGrainTexture(seed = 1): THREE.CanvasTexture {
  const { element, ctx } = canvas(512, 128);
  let state = seed * 9301;
  const rand = () => ((state = (state * 9301 + 49297) % 233280) / 233280);

  ctx.fillStyle = '#c39a63';
  ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    const y = rand() * 128;
    const dark = rand() > 0.55;
    ctx.strokeStyle = dark ? `rgba(122, 84, 44, ${0.1 + rand() * 0.22})` : `rgba(226, 195, 152, ${0.1 + rand() * 0.2})`;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / 512) * Math.PI * (1 + rand() * 2) + i) * (1.5 + rand() * 3));
    }
    ctx.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const cx = 60 + rand() * 400;
    const cy = 20 + rand() * 88;
    for (let r = 9; r > 0; r--) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 2.1, r * 1.15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(96, 63, 32, ${0.05 + r * 0.022})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }
  return finish(element, [1, 1]);
}

/** End grain for the raw timber close-up: concentric growth rings on the cut face. */
export function endGrainTexture(): THREE.CanvasTexture {
  const { element, ctx } = canvas(256, 256);
  ctx.fillStyle = '#c4ae90';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 26; i > 0; i--) {
    ctx.beginPath();
    ctx.ellipse(128, 128, i * 4.7 * (1 + Math.sin(i) * 0.02), i * 4.4, 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(112, 76, 40, 0.5)' : 'rgba(214, 180, 132, 0.45)';
    ctx.lineWidth = i % 2 === 0 ? 2.2 : 4.5;
    ctx.stroke();
  }
  return finish(element);
}

/**
 * Corrugated carton face: flap seam across the middle and a small stamped label block.
 * One texture serves every face of the instanced box, so the whole load costs one draw call.
 */
export function cartonTexture(): THREE.CanvasTexture {
  const { element, ctx } = canvas(256, 256);
  ctx.fillStyle = '#a87d51';
  ctx.fillRect(0, 0, 256, 256);
  // fibre speckle
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${140 + Math.random() * 40}, ${105 + Math.random() * 35}, ${70 + Math.random() * 30}, 0.35)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
  }
  // flap seam
  ctx.strokeStyle = 'rgba(88, 60, 33, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232, 210, 178, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 132);
  ctx.lineTo(256, 132);
  ctx.stroke();
  // printed label block
  ctx.fillStyle = 'rgba(60, 44, 28, 0.82)';
  ctx.fillRect(38, 44, 96, 5);
  ctx.font = 'bold 21px monospace';
  ctx.fillStyle = 'rgba(58, 41, 25, 0.9)';
  ctx.fillText('BOX', 38, 78);
  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(58, 41, 25, 0.68)';
  ctx.fillText('PRODUCT', 38, 98);
  ctx.fillText('LOT ——', 38, 116);
  // handling stripes
  ctx.fillStyle = 'rgba(58, 41, 25, 0.5)';
  for (let i = 0; i < 3; i++) ctx.fillRect(176, 168 + i * 12, 44, 4);
  return finish(element);
}

/** Stretch film: faint diagonal streaks so the wrap reads as film rather than as tinted glass. */
export function filmTexture(): THREE.CanvasTexture {
  const { element, ctx } = canvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(226, 236, 240, 0.30)';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.lineWidth = 8;
  for (let i = -256; i < 512; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 120, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

export type SceneMaterials = {
  wood: THREE.MeshStandardMaterial[];
  rawTimber: THREE.MeshStandardMaterial;
  endGrain: THREE.MeshStandardMaterial;
  carton: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  steelDark: THREE.MeshStandardMaterial;
  nail: THREE.MeshStandardMaterial;
  beacon: THREE.MeshStandardMaterial;
  film: THREE.MeshPhysicalMaterial;
  floor: THREE.MeshStandardMaterial;
};

/**
 * Three wood variants share one grain texture: enough tonal spread that a deck of boards does
 * not look extruded from a single block, without a material (and a draw call) per board.
 */
export function createMaterials(): SceneMaterials {
  const grain = woodGrainTexture(3);
  const wood = ['#b08d61', '#a37f52', '#bd9b6e', '#aa8558', '#b79365'].map(
    (color, i) =>
      new THREE.MeshStandardMaterial({ color, map: grain, roughness: 0.83 + (i % 3) * 0.02, metalness: 0 }),
  );

  return {
    wood,
    rawTimber: new THREE.MeshStandardMaterial({ color: '#a08d76', map: grain, roughness: 0.92 }),
    endGrain: new THREE.MeshStandardMaterial({ map: endGrainTexture(), roughness: 0.7 }),
    carton: new THREE.MeshStandardMaterial({ map: cartonTexture(), color: '#9d7448', roughness: 0.92, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8d9298', roughness: 0.42, metalness: 0.75 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#343943', roughness: 0.66, metalness: 0.35 }),
    nail: new THREE.MeshStandardMaterial({ color: '#6f6b66', roughness: 0.5, metalness: 0.7 }),
    beacon: new THREE.MeshStandardMaterial({
      color: '#e8a33c',
      emissive: '#e8862c',
      emissiveIntensity: 1.6,
      roughness: 0.35,
    }),
    film: new THREE.MeshPhysicalMaterial({
      map: filmTexture(),
      color: '#dbe8ee',
      roughness: 0.32,
      metalness: 0,
      transmission: 0,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    // DoubleSide: the cyclorama is an open ribbon, and a backdrop that vanishes when the
    // camera crosses its plane is a worse bug than one extra face per triangle.
    floor: new THREE.MeshStandardMaterial({ color: '#2b2825', roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide }),
  };
}
