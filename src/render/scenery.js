import * as THREE from 'three';

import { LANES } from '../core/tuning.js';
import { builder, tile } from './build.js';
import { flat, neon, SURFACE } from './materials.js';
import { THEME } from './theme.js';

/**
 * What stands beside the walkway rather than on it. None of it is in the
 * snapshot and none of it can be hit — a railing the egg could run through
 * would be a lie, so the railings are outside the lanes where the egg cannot
 * reach them, and the only thing in a lane is a cam.
 *
 * Everything here is driven down the face of the deck's own truss. There is
 * no ground out there to bolt anything to; root it at zero and the whole
 * railing hangs in the air over a city.
 */

const POST_GAP = 3.2;
const ROOT = -0.8;

/** Handrail down one side. Nobody has ever leant on it. */
function railing(side, w, l) {
  const steel = builder();
  const x = side * (w / 2 + 0.42);
  const from = -l / 2 + 0.7;
  const to = l / 2 - 0.7;
  const head = 1.0;

  for (let z = from; z <= to + 0.01; z += POST_GAP) {
    steel.box(x, (ROOT + head) / 2, z, 0.1, head - ROOT, 0.1);
  }
  steel.box(x, head, (from + to) / 2, 0.11, 0.09, to - from);
  steel.box(x, 0.52, (from + to) / 2, 0.06, 0.06, to - from);

  const mesh = new THREE.Mesh(steel.geometry(), SURFACE.rail());
  mesh.name = 'railing';
  return mesh;
}

/** The slogans. Nobody wrote them; they were optimised. */
const COPY = [
  ['OWN', 'NOTHING'],
  ['BE', 'OPTIMISED'],
  ['TRUST', 'THE MODEL'],
  ['ALWAYS', 'BE LIQUID'],
  ['YOUR SHIFT', 'NEVER ENDS'],
  ['WE SEE', 'YOU'],
  ['SYNERGY', 'CREDIT™'],
  ['EARN', 'YOUR AIR'],
];

const boards = new Map();

/**
 * A gantry sign, painted once per slogan and shared by every copy of it after
 * that. It is unlit and drawn at full brightness, because a hoarding in this
 * city is not a surface with a light on it — it is the light.
 *
 * It spans the walkway and hangs over it rather than standing beside it. A
 * sign at the edge either floats — there is nothing out there to stand on —
 * or crowds the lane you are trying to read; slung between two masts it is
 * held up by the thing it is bolted to, and you run under it.
 *
 * Its masts are cut to `w`, which is safe to bake into the shared pattern
 * only because `dress` turns back anything narrower than the full walkway.
 */
function hoarding(index, w) {
  /**
   * Keyed by the slogan, not by the deck. Keyed by the deck it was one
   * canvas, one texture and a board's worth of geometry per dressed deck —
   * held in here for the whole run, because ids never come round again — and
   * every word of it had been painted six signs ago.
   */
  const slogan = index % COPY.length;
  if (!boards.has(slogan)) {
    const [top, bottom] = COPY[slogan];
    const accent = slogan % 2 ? THEME.magenta : THEME.cyan;
    const hex = `#${accent.toString(16).padStart(6, '0')}`;

    let material = flat({ color: accent });
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#080a12';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = hex;
        ctx.lineWidth = 6;
        ctx.strokeRect(14, 14, 484, 228);
        ctx.fillStyle = hex;
        ctx.textAlign = 'center';
        ctx.font = 'bold 74px ui-monospace, monospace';
        ctx.fillText(top, 256, 112);
        ctx.fillText(bottom, 256, 194);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshBasicMaterial({ map: tex });
      }
    }

    const board = new THREE.Group();
    board.name = 'hoarding';
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), material);
    panel.position.set(0, 3.5, 0);
    /** A plane's front is +z and the egg arrives from -z, so an unturned
     *  hoarding sells to the empty walkway behind it. */
    panel.rotation.y = Math.PI;
    board.add(panel);

    const rig = builder();
    const reach = w / 2 + 0.42;
    for (const side of [-1, 1]) rig.box(side * reach, (ROOT + 4.7) / 2, 0, 0.18, 4.7 - ROOT, 0.18);
    rig.box(0, 4.66, 0, reach * 2, 0.16, 0.16);
    for (const side of [-1, 1]) rig.box(side * 1.5, 4.2, 0, 0.07, 0.95, 0.07);
    board.add(new THREE.Mesh(rig.geometry(), SURFACE.frame()));

    const tube = builder();
    tube.box(0, 2.52, 0, 3.7, 0.07, 0.07);
    board.add(new THREE.Mesh(tube.geometry(), neon(THEME.magenta, 1.4)));

    boards.set(slogan, board);
  }

  /**
   * A clone shares the pattern's geometry, which outlives any one deck — so
   * it is marked, and `disposeDeck` leaves everything under it alone.
   */
  const sign = boards.get(slogan).clone();
  sign.userData.shared = true;
  return sign;
}

/**
 * A tower, off in the middle distance.
 *
 * Built at its own size rather than cloned and scaled, because the windows
 * are a texture: scale a shared box to forty metres and the floors stretch
 * with it, and a building whose storeys are nine metres tall reads as a
 * photograph of a building rather than as one.
 *
 * They hang off decks rather than off a grid that recentres on the egg, which
 * is the only way they go past. A skyline pinned to the camera never moves,
 * and nothing gives a backdrop away faster.
 */
function tower(wide, high, base) {
  const group = new THREE.Group();

  const shaft = builder();
  shaft.box(0, base + high / 2, 0, wide, high, wide);
  /**
   * The tile carries fourteen window bays across and twenty-two storeys up,
   * so it has to be stretched over about forty metres by seventy for a window
   * to come out window-sized. Tile it by the metre instead and the bays land
   * a handspan apart, which from three hundred metres away is not a building,
   * it is a grey rectangle.
   */
  group.add(new THREE.Mesh(tile(shaft.geometry(), wide / 40, high / 64), SURFACE.facade()));

  const crown = builder();
  crown.box(0, base + high + 0.5, 0, wide * 0.28, 0.6, wide * 0.28);
  group.add(new THREE.Mesh(crown.geometry(), neon(THEME.cyan, 1.3)));

  return group;
}

/**
 * What this deck happens to have bolted to it. `seg.dressing` was rolled off
 * the course's own seeded stream, so a seed dresses its city the same way
 * every time — and the renderer stays a function of the snapshot.
 */
export function dress(seg, w, l) {
  if (seg.span !== LANES || l < 11) return [];

  const props = [];
  const side = seg.dressing % 2 ? 1 : -1;

  props.push(railing(side, w, l));
  if (seg.dressing === 3) props.push(railing(-side, w, l));

  if (seg.dressing !== 3 && l > 15) {
    const sign = hoarding(seg.id, w);
    sign.position.set(0, 0, seg.dressing === 2 ? l * 0.22 : 0);
    props.push(sign);
  }

  /** Two towers a long way out, at heights the deck's id decides. */
  for (const away of [-1, 1]) {
    if ((seg.id + (away > 0 ? 1 : 0)) % 3) continue;
    const high = 26 + ((seg.id * 37 + away * 11) % 5) * 9;
    const wide = 7 + ((seg.id * 13 + away * 7) % 4) * 2.5;
    const out = away * (w / 2 + 16 + ((seg.id * 17) % 5) * 5);

    const it = tower(wide, high, -46);
    it.position.set(out, 0, ((seg.id * 29) % 17) - 8);
    props.push(it);
  }

  return props;
}
