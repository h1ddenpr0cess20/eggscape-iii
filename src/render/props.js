import { CAM } from '../core/tuning.js';
import { cylinder, Geometry, plane, sphere } from '../gpu/geometry.js';
import { Group, Mesh } from '../gpu/graph.js';
import { builder, FACE, tile } from './build.js';
import { flat, gaze, marking, matte, neon, spill, SURFACE } from './materials.js';
import { dress } from './scenery.js';
import { THEME } from './theme.js';

/** How deep the truss under a deck runs, and how wide the lit edge strip is
 *  that marks where the deck stops and the canyon starts. */
const DEPTH = 0.8;
const EDGE = 0.26;

/**
 * A deck: plate over a steel truss, with a lit strip down each long edge.
 *
 * The strip is not decoration. It sits exactly as far out as the collider's
 * own edge margin, so the line you can see is the line you can stand on —
 * in a scene this dark, an unlit edge is a gap you find by falling into it.
 *
 * One lane wide it stops being a walkway at all and becomes a bare girder,
 * which is the only honest thing a strip of structure that narrow can be.
 */
export function createDeck(seg) {
  const group = new Group();
  group.name = `deck-${seg.id}`;

  const w = seg.xMax - seg.xMin;
  const l = seg.z1 - seg.z0;
  const girder = seg.span === 1;

  const top = plane(w, l);
  /** One panel per lane across, one every two metres along: the plate's own
   *  seam then draws the lane divisions without anything placing them. */
  tile(top, girder ? 1 : seg.span, l / 2);
  const plate = new Mesh(top, girder ? SURFACE.grate() : SURFACE.plate());
  plate.rotation.x = -Math.PI / 2;
  group.add(plate);

  /** The truss it is all bolted to. No top face: the plate is the top. */
  const truss = builder();
  truss.box(0, -DEPTH / 2, 0, w, DEPTH, l, 63 & ~FACE.py);
  /** Cross-braces, so it reads as held up rather than as floating. */
  for (let z = -l / 2 + 2; z < l / 2 - 1; z += 4) {
    truss.box(0, -DEPTH + 0.12, z, w * 0.98, 0.16, 0.3);
  }
  group.add(new Mesh(truss.geometry(), SURFACE.frame()));

  const strip = builder();
  const h = 0.1;
  for (const side of [-1, 1]) strip.box(side * (w / 2 + EDGE / 2), -h / 2 + 0.01, 0, EDGE, h, l);
  group.add(new Mesh(strip.geometry(), neon(girder ? THEME.amber : THEME.cyan, 1.5)));

  /**
   * Service lighting along the bottom of the truss. Without it the structure
   * under the plate is a black slab hanging in a black canyon, and the one
   * thing the player has to believe about this walkway is that it is a long
   * way up — which it cannot be if nothing under it catches any light.
   */
  const service = builder();
  for (const side of [-1, 1]) {
    service.box(side * (w / 2 - 0.04), -DEPTH + 0.09, 0, 0.08, 0.05, l * 0.98);
    /** And across the ends, which is the face you get looking straight at a
     *  deck a tier above the one you are on. */
    service.box(0, -DEPTH + 0.09, side * (l / 2 - 0.04), w * 0.98, 0.05, 0.08);
  }
  group.add(new Mesh(service.geometry(), neon(THEME.amber, 0.85)));

  for (const prop of dress(seg, w, l)) group.add(prop);

  group.position.set((seg.xMin + seg.xMax) / 2, seg.y, (seg.z0 + seg.z1) / 2);
  return group;
}

/**
 * Materials are shared and stay; the geometry belongs to this deck — except
 * under a node the scenery has marked as shared, which is a clone of a
 * pattern every other deck's copy is drawn from. Dropping one deck's
 * hoarding used to free the buffers behind every hoarding in the city, and
 * the driver quietly uploaded them all again on the next frame.
 */
export function disposeDeck(group) {
  if (group.userData.shared) return;
  group.geometry?.dispose();
  for (const child of group.children) disposeDeck(child);
}

/**
 * A cone of sight off a lens, pointing down -z — the way the egg comes from —
 * and tipped down by `drop` so it lands on the deck in front of the cam. It
 * is bright at the lens and fades to nothing at its far rim, which is all a
 * vertex colour has to say about it.
 */
function sightline(length, radius, drop, segments = 18) {
  const position = [0, 0, 0];
  const color = [1, 1, 1];
  const index = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    position.push(Math.cos(a) * radius, Math.sin(a) * radius, -length);
    color.push(0, 0, 0);
    if (i > 0) index.push(0, i, i + 1);
  }
  const mesh = new Mesh(new Geometry({ position, color, index }), gaze());
  mesh.rotation.x = -Math.atan2(drop, length);
  mesh.name = 'gaze';
  return mesh;
}

/** A tally light: the little red dot that says this one is recording. */
function tally(x, y, z) {
  const light = new Mesh(sphere(0.05, 10, 8), neon(THEME.alert, 2.4));
  light.position.set(x, y, z);
  light.name = 'tally';
  return light;
}

/**
 * Something watching the lane, in the three shapes the city watches in. All
 * of them stand as tall and as wide as the collider says, because the thing
 * you have to hop is the thing you can see — and all of them put their lens
 * on the side the egg is coming from, which is the only warning there is.
 */
export function createCam(kind = 0) {
  const group = new Group();
  const w = CAM.halfWidth * 2;
  const d = CAM.halfDepth * 2;

  /**
   * The footprint. Every cam stands on a lit patch of its own the exact size
   * of its collider, because the rest of it is dark equipment on a dark deck
   * at night in the rain — findable, at speed, only by running into it.
   */
  if (kind === 1) {
    const light = new Mesh(plane(w * 1.7, d * 1.9), spill());
    light.rotation.x = -Math.PI / 2;
    light.position.y = 0.015;
    light.name = 'pool';
    group.add(light);
  } else {
    const pad = new Mesh(plane(w, d), marking());
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.012;
    group.add(pad);
  }

  if (kind === 0) {
    /** Post cam: bolted down, and it turns to keep up with you. */
    const mast = builder();
    mast.box(0, 0.08, 0, w * 0.6, 0.14, d * 0.6);
    mast.box(0, 0.34, 0, 0.16, 0.5, 0.16);
    group.add(new Mesh(mast.geometry(), SURFACE.steel()));

    const head = new Group();
    head.name = 'head';
    head.position.y = 0.66;

    const shell = builder();
    shell.box(0, 0, 0.04, 0.34, 0.3, 0.46);
    shell.box(0, 0.19, 0.08, 0.38, 0.08, 0.34);
    head.add(new Mesh(shell.geometry(), SURFACE.housing()));

    const lens = new Mesh(cylinder(0.12, 0.14, 0.06, 14), neon(THEME.alert, 2.2));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, -0.2);
    lens.name = 'lens';
    head.add(lens);

    const sight = sightline(3.2, 0.85, 0.66);
    sight.position.set(0, 0, -0.23);
    head.add(sight, tally(0.12, 0.27, 0.12));

    group.add(head);
  } else if (kind === 1) {
    /** Drone: no bolts, no mast, and it does not have to stay where it is. */
    const hull = new Group();
    hull.name = 'head';
    hull.position.y = CAM.height * 0.52;

    const body = builder();
    body.box(0, 0, 0, 0.46, 0.2, 0.36);
    for (const side of [-1, 1]) {
      body.box(side * 0.4, 0.02, 0, 0.4, 0.07, 0.07);
      body.box(side * 0.4, 0.02, -0.22, 0.07, 0.07, 0.36);
    }
    hull.add(new Mesh(body.geometry(), SURFACE.housing()));

    for (const side of [-1, 1]) {
      for (const z of [-0.22, 0.22]) {
        const rotor = new Mesh(cylinder(0.15, 0.15, 0.012, 12), matte(0x171b23, { roughness: 0.6 }));
        rotor.position.set(side * 0.46, 0.08, z);
        hull.add(rotor);
      }
    }

    /** A strip down the hull, so it is machinery and not a smear — in the
     *  red every cam wears, not the cyan the walkway's own edges are. */
    const trim = builder();
    trim.box(0, 0.08, 0, 0.3, 0.03, 0.38);
    hull.add(new Mesh(trim.geometry(), neon(THEME.alert, 1.1)));

    const eye = new Mesh(sphere(0.12, 12, 10), neon(THEME.alert, 2.2));
    eye.position.set(0, -0.08, -0.14);
    eye.name = 'lens';
    hull.add(eye);

    const sight = sightline(3, 0.8, 0.42);
    sight.position.set(0, -0.08, -0.26);
    hull.add(sight, tally(0, 0.14, 0.12));

    group.add(hull);
  } else {
    /** Turnstile: the city would rather charge you than chase you. */
    const post = builder();
    post.box(0, CAM.height / 2, 0, 0.18, CAM.height, 0.18);
    post.box(0, 0.07, 0, 0.42, 0.12, 0.42);
    group.add(new Mesh(post.geometry(), SURFACE.steel()));

    const arms = builder();
    /** Two bars across the lane, and a stub pointing back at you. */
    for (const y of [0.42, 0.74]) arms.box(0, y, 0, w * 0.98, 0.09, 0.09);
    arms.box(0, 0.58, -d * 0.4, 0.09, 0.09, d * 0.8);
    group.add(new Mesh(arms.geometry(), SURFACE.hazard()));

    const reader = new Mesh(plane(0.2, 0.26), neon(THEME.alert, 1.9));
    reader.position.set(0, CAM.height * 0.86, -0.1);
    reader.rotation.y = Math.PI;
    reader.name = 'lens';
    group.add(reader);

    const sight = sightline(2.6, 0.7, CAM.height * 0.86);
    sight.position.set(0, CAM.height * 0.86, -0.12);
    group.add(sight, tally(0, CAM.height + 0.05, 0));
  }

  /**
   * The head, the lens, the gaze and the tally light, handed over rather
   * than looked up: the renderer turns, brightens and blinks them every frame
   * for every cam in shot, and a search of the group is a search.
   *
   * The lens and the tally also get materials of their own (the gaze is made
   * per cam already). Everything `neon` hands back is shared, so writing this
   * one's brightness wrote every cam's — the whole field of them pulsed
   * together on whichever was drawn last, and the one tell the player gets
   * that *this* cam has seen them said nothing at all.
   */
  const lens = group.getObjectByName('lens');
  if (lens) lens.material = lens.material.clone();
  const light = group.getObjectByName('tally');
  light.material = light.material.clone();
  group.userData.head = group.getObjectByName('head');
  group.userData.lens = lens;
  group.userData.gaze = group.getObjectByName('gaze');
  group.userData.tally = light;

  return group;
}

/**
 * The city under the walkway. It is a very long way down and lit by nothing
 * up here — flat colour, no shading — because at that distance a lit surface
 * only ever resolves into the same haze the fog gives it for free.
 *
 * It reaches further than the fog does on purpose. Stop it short of the far
 * plane and its own edge draws a hard line across the horizon.
 */
export function createCity({ half = 190, tiles = 13, y = -46 } = {}) {
  const group = new Group();
  group.name = 'city';

  const ground = plane(half * 2, half * 2);
  tile(ground, tiles, tiles);
  const streets = new Mesh(ground, flat({ map: 'city' }));
  streets.rotation.x = -Math.PI / 2;
  streets.position.y = y;
  group.add(streets);

  return { object: group, spacing: (half * 2) / tiles, y };
}

