import * as THREE from 'three';

import { EGG_HEIGHT } from '../core/shape.js';
import { PLAYER } from '../core/tuning.js';
import { shade } from './materials.js';
import { createShell } from './shell.js';

/** The shaped shell has its own height; the egg has to fit the collider. */
export const EGG_SCALE = PLAYER.height / EGG_HEIGHT;

/**
 * Marc, as he is. Same geometry, same speckled skin, same physical material
 * as he has always had — nothing was added to him for this and nothing was
 * taken away.
 *
 * He is the only thing in the city that is not owned, rented, metered or
 * watching, and the only warm colour in it that is not selling something.
 * That is the whole point of leaving him alone.
 */
export function createEgg() {
  const egg = new THREE.Group();
  egg.name = 'egg';

  const shell = createShell();

  const body = new THREE.Group();
  body.name = 'body';
  body.add(shell.mesh);

  egg.add(body);
  egg.scale.setScalar(EGG_SCALE);

  return { object: egg, body, shell };
}

/**
 * What the egg drops on the plate under it. Nothing in here casts a real
 * shadow — the light comes from four directions and none of it cares — but
 * the height of a hop is unreadable without one, so this is the instrument
 * as much as it is the scenery.
 */
export function createShadow(radius = 0.72) {
  const blot = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), shade());
  blot.rotation.x = -Math.PI / 2;
  blot.renderOrder = 1;
  blot.name = 'shadow';
  return blot;
}
