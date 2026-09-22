import * as THREE from 'three';

import { builder } from './build.js';
import { denomination, matte, neon } from './materials.js';
import { DENOMINATION } from './theme.js';

/**
 * Six things the city pays in, one builder each. They are all about a fist
 * across and all have to read from behind at twenty metres a second against
 * a deck the colour of a wet road, which is the only brief — so every one of
 * them carries its own light.
 *
 * Each is a Group so the renderer can turn it on the spot; the course decides
 * which denomination is where, so a keycard stays a keycard for a whole run.
 */

function skin(kind, which = 'body') {
  return denomination(DENOMINATION[kind][which]);
}

/** A chit: the smallest unit of being paid, and it is a token. */
function chit(kind) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 20), skin(kind));
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 6, 22), neon(DENOMINATION[kind].trim, 1.5));
  rim.position.z = -0.028;
  group.add(rim);
  return group;
}

/** A shard: the only thing in here the egg has seen before. */
function shard(kind) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), skin(kind));
  core.scale.set(0.8, 1.15, 0.8);
  group.add(core);

  /** The haze is asked for, not applied afterwards: everything `neon` hands
   *  back is shared, and a thing that turns its own material see-through
   *  turns it see-through for whatever else was given the same one. */
  const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), neon(DENOMINATION[kind].trim, 0.6, 0.16));
  halo.scale.set(0.8, 1.15, 0.8);
  group.add(halo);
  return group;
}

/** A cell: charge, which is the only thing anybody is actually paid in. */
function cell(kind) {
  const group = new THREE.Group();
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.44, 12), matte(DENOMINATION[kind].trim, { roughness: 0.5, metalness: 0.4 }));
  group.add(casing);

  for (const y of [-0.08, 0.08]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.157, 0.07, 12), skin(kind));
    band.position.y = y;
    group.add(band);
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), skin(kind));
  cap.position.y = 0.24;
  group.add(cap);
  return group;
}

/** A keycard: access, revocable, and the colour of a nightclub. */
function keycard(kind) {
  const group = new THREE.Group();
  const card = builder();
  card.box(0, 0, 0, 0.46, 0.3, 0.025);
  group.add(new THREE.Mesh(card.geometry(), skin(kind)));

  const stripe = builder();
  stripe.box(0, -0.07, -0.017, 0.46, 0.07, 0.01);
  stripe.box(0.13, 0.07, -0.017, 0.14, 0.08, 0.01);
  group.add(new THREE.Mesh(stripe.geometry(), neon(DENOMINATION[kind].trim, 1.3)));
  return group;
}

/** A die: somebody else's compute, sold back to you by the second. */
function die(kind) {
  const group = new THREE.Group();
  const slab = builder();
  slab.box(0, 0, 0, 0.36, 0.07, 0.36);
  group.add(new THREE.Mesh(slab.geometry(), matte(0x1b202a, { roughness: 0.5, metalness: 0.4 })));

  const wafer = builder();
  wafer.box(0, 0.045, 0, 0.2, 0.025, 0.2);
  group.add(new THREE.Mesh(wafer.geometry(), skin(kind)));

  const pins = builder();
  for (let i = -2; i <= 2; i++) {
    for (const side of [-1, 1]) {
      pins.box(side * 0.2, -0.01, i * 0.07, 0.08, 0.02, 0.03);
      pins.box(i * 0.07, -0.01, side * 0.2, 0.03, 0.02, 0.08);
    }
  }
  group.add(new THREE.Mesh(pins.geometry(), neon(DENOMINATION[kind].trim, 0.9)));
  return group;
}

/** A tick: the number going up, which is not the same as you going up. */
function tick(kind) {
  const group = new THREE.Group();
  const arrow = new THREE.Group();

  for (const side of [-1, 1]) {
    const limb = builder();
    limb.box(0, 0, 0, 0.1, 0.34, 0.06);
    const bar = new THREE.Mesh(limb.geometry(), skin(kind));
    bar.rotation.z = side * 0.72;
    bar.position.set(side * 0.11, -0.02, 0);
    arrow.add(bar);
  }

  const stem = builder();
  stem.box(0, -0.2, 0, 0.09, 0.26, 0.06);
  arrow.add(new THREE.Mesh(stem.geometry(), skin(kind)));

  arrow.position.y = 0.07;
  group.add(arrow);
  return group;
}

const MINTS = [chit, shard, cell, keycard, die, tick];

/** One of the six, by the denomination the course rolled for it. */
export function createCredit(kind) {
  const at = kind % MINTS.length;
  const group = MINTS[at](at);
  group.name = DENOMINATION[at].name;
  return group;
}

export const KINDS = MINTS.length;
