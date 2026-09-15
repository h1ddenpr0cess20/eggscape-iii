import * as THREE from 'three';

/**
 * The city's surfaces, painted onto canvases at boot. Nothing here is loaded
 * over the wire: the whole place is four procedural tiles, which is why a
 * dystopia this size is still a page and not a download.
 */

const cache = new Map();

function paint(size, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  /** Every one of these is looked at almost edge-on for most of its life,
   *  which is exactly where a mipmap gives up. Worth the samples. */
  texture.anisotropy = 16;
  return texture;
}

function grime(ctx, size, count, colours, radius = 3) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colours[(Math.random() * colours.length) | 0];
    const r = 0.6 + Math.random() * radius;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Deck plate. The seam runs round the edge of the tile, so the repeat draws
 * the join between one panel and the next — and because a full deck tiles one
 * panel per lane, the seams land exactly on the lane divisions without
 * anything having to place them there.
 */
function plate(ctx, size) {
  ctx.fillStyle = '#333a48';
  ctx.fillRect(0, 0, size, size);

  /** Rolled steel: long faint streaks down the panel. */
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(20,24,32,0.5)' : 'rgba(64,74,92,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, Math.random() * size);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, Math.random() * size);
    ctx.stroke();
  }

  grime(ctx, size, 420, ['rgba(14,17,23,0.5)', 'rgba(74,86,106,0.22)', 'rgba(52,40,32,0.3)']);

  /** Tread: a field of raised diamonds, the way a walkway plate is made. */
  const step = size / 16;
  for (let gx = 0; gx < 16; gx++) {
    for (let gy = 0; gy < 16; gy++) {
      const cx = (gx + 0.5) * step + (gy % 2 ? step / 2 : 0);
      const cy = (gy + 0.5) * step;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(104,120,146,0.3)';
      ctx.fillRect(-step * 0.17, -step * 0.17, step * 0.34, step * 0.34);
      ctx.fillStyle = 'rgba(12,15,20,0.3)';
      ctx.fillRect(-step * 0.17, step * 0.08, step * 0.34, step * 0.09);
      ctx.restore();
    }
  }

  /** The panel seam, and the bolts down it. */
  const seam = Math.max(3, size / 128);
  ctx.fillStyle = 'rgba(8,10,14,0.9)';
  ctx.fillRect(0, 0, size, seam);
  ctx.fillRect(0, size - seam, size, seam);
  ctx.fillRect(0, 0, seam, size);
  ctx.fillRect(size - seam, 0, seam, size);

  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16 * size;
    for (const [x, y] of [[t, seam * 2.4], [t, size - seam * 2.4], [seam * 2.4, t], [size - seam * 2.4, t]]) {
      ctx.fillStyle = 'rgba(96,110,132,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, seam * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Open mesh, for the parts of the walkway nobody bothered to plate. */
function grate(ctx, size) {
  ctx.fillStyle = '#12161e';
  ctx.fillRect(0, 0, size, size);

  const bars = 18;
  const step = size / bars;
  for (let i = 0; i < bars; i++) {
    const p = i * step;
    ctx.fillStyle = 'rgba(70,82,100,0.85)';
    ctx.fillRect(p, 0, step * 0.34, size);
    ctx.fillRect(0, p, size, step * 0.34);
    ctx.fillStyle = 'rgba(112,128,152,0.5)';
    ctx.fillRect(p, 0, step * 0.12, size);
    ctx.fillRect(0, p, size, step * 0.12);
  }
  grime(ctx, size, 300, ['rgba(6,8,12,0.55)', 'rgba(58,44,34,0.35)'], 2.4);
}

/**
 * The city, from directly above and a very long way up. Streets carry the
 * light; the blocks between them are where people are. It tiles, because at
 * that distance nobody has ever counted the blocks.
 */
function city(ctx, size) {
  ctx.fillStyle = '#06080f';
  ctx.fillRect(0, 0, size, size);

  const blocks = 8;
  const step = size / blocks;

  for (let gx = 0; gx < blocks; gx++) {
    for (let gy = 0; gy < blocks; gy++) {
      const shade = 10 + Math.random() * 16;
      ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 9})`;
      ctx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
    }
  }

  /** Streets, lit the colour sodium always was. */
  ctx.strokeStyle = 'rgba(255,138,61,0.5)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i <= blocks; i++) {
    const p = i * step;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  /** Somebody is awake in most of them. */
  for (let i = 0; i < 1800; i++) {
    const warm = Math.random() < 0.78;
    ctx.fillStyle = warm
      ? `rgba(255,207,133,${0.25 + Math.random() * 0.5})`
      : `rgba(47,230,255,${0.2 + Math.random() * 0.45})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
  }

  /** And a few junctions that never go dark. */
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14 + Math.random() * 22);
    const neon = Math.random() < 0.5 ? '255,47,158' : '47,230,255';
    g.addColorStop(0, `rgba(${neon},0.42)`);
    g.addColorStop(1, `rgba(${neon},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
  }
}

/** A tower's face: mostly dark, and the dark is the point. */
function facade(ctx, size) {
  ctx.fillStyle = '#0b0e16';
  ctx.fillRect(0, 0, size, size);

  const cols = 14;
  const rows = 22;
  const w = size / cols;
  const h = size / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const lit = Math.random();
      if (lit > 0.42) continue;
      const warm = Math.random() < 0.72;
      const a = 0.25 + Math.random() * 0.6;
      ctx.fillStyle = warm ? `rgba(255,201,126,${a})` : `rgba(120,200,255,${a * 0.8})`;
      ctx.fillRect(c * w + w * 0.2, r * h + h * 0.22, w * 0.6, h * 0.5);
    }
  }

  /** Floor bands, so it reads as a building and not as static. */
  ctx.fillStyle = 'rgba(4,6,10,0.75)';
  for (let r = 0; r < rows; r++) ctx.fillRect(0, r * h + h * 0.78, size, h * 0.22);
}

/** Painted deck marking: the stripe that means equipment, everywhere. */
function hazard(ctx, size) {
  ctx.fillStyle = '#16181f';
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-size, -size);
  const band = size / 5;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#ffb23d' : '#1b1e26';
    ctx.fillRect(i * band, 0, band, size * 2);
  }
  ctx.restore();
  grime(ctx, size, 260, ['rgba(8,10,14,0.5)', 'rgba(90,70,40,0.3)'], 2.4);
}

const PAINTERS = { plate, grate, city, facade, hazard };

/** One texture per surface, for the whole run. */
export function texture(name) {
  if (!cache.has(name)) cache.set(name, paint(512, PAINTERS[name]));
  return cache.get(name);
}

/**
 * The pool of light a drone throws on the plate under itself. A drone has no
 * base to paint a stripe round, and something you have to dodge that owns no
 * ground is something you find out about by hitting it.
 */
export function pool() {
  if (cache.has('pool')) return cache.get('pool');
  const made = paint(128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,45,74,0.85)');
    g.addColorStop(0.42, 'rgba(255,45,74,0.3)');
    g.addColorStop(0.78, 'rgba(255,45,74,0.09)');
    g.addColorStop(1, 'rgba(255,45,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  if (made) {
    made.wrapS = THREE.ClampToEdgeWrapping;
    made.wrapT = THREE.ClampToEdgeWrapping;
  }
  cache.set('pool', made);
  return made;
}

/**
 * The smudge the egg drops on the plate. The city casts no real shadow — the
 * light comes from everywhere and none of it cares — but the height of a hop
 * is unreadable without one, so this is the instrument as much as the scenery.
 */
export function blot() {
  if (cache.has('blot')) return cache.get('blot');
  const made = paint(128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(2,3,6,0.8)');
    g.addColorStop(0.45, 'rgba(2,3,6,0.44)');
    g.addColorStop(1, 'rgba(2,3,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
  if (made) {
    made.wrapS = THREE.ClampToEdgeWrapping;
    made.wrapT = THREE.ClampToEdgeWrapping;
  }
  cache.set('blot', made);
  return made;
}
