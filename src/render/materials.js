import * as THREE from 'three';

import { blot, pool, texture } from './textures.js';
import { THEME } from './theme.js';

/**
 * Every surface in the city, shared. A run builds a few hundred objects out
 * of about a dozen materials, and a material is a shader program — making one
 * per cam is how a city becomes a slideshow.
 */
const cache = new Map();

/** Painted matte: a colour, optionally tiled with one of the four tiles. */
export function matte(color, { map = null, roughness = 0.82, metalness = 0.12, glow = 0 } = {}) {
  const key = `${color}:${map}:${roughness}:${metalness}:${glow}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color,
      map: map ? texture(map) : null,
      roughness,
      metalness,
      emissive: glow > 0 ? new THREE.Color(color) : new THREE.Color(0x000000),
      emissiveIntensity: glow,
    }));
  }
  return cache.get(key);
}

export const SURFACE = {
  plate: () => matte(0xffffff, { map: 'plate', roughness: 0.62, metalness: 0.35 }),
  grate: () => matte(0xffffff, { map: 'grate', roughness: 0.7, metalness: 0.4 }),
  facade: () => windows(),
  frame: () => matte(THEME.frame, { roughness: 0.78, metalness: 0.45 }),
  steel: () => matte(THEME.steel, { roughness: 0.55, metalness: 0.55 }),
  rail: () => matte(THEME.rail, { roughness: 0.5, metalness: 0.6 }),
  housing: () => matte(0x39414f, { roughness: 0.42, metalness: 0.55 }),
  hazard: () => matte(THEME.hazard, { roughness: 0.75, metalness: 0.2 }),
};

/**
 * A tower's face. The windows in the texture are not paint, they are light —
 * so the same map goes in as the emissive map and the building glows out of
 * its own dark rather than waiting for a lamp that is never coming.
 */
function windows() {
  if (!cache.has('windows')) {
    cache.set('windows', new THREE.MeshStandardMaterial({
      color: 0x0a0d14,
      emissive: 0xffffff,
      emissiveMap: texture('facade'),
      emissiveIntensity: 1.7,
      roughness: 1,
      metalness: 0,
    }));
  }
  return cache.get('windows');
}

/**
 * Neon. Black where the light does not fall and its own colour where it does,
 * which is what a lit tube actually is — a diffuse colour here would go grey
 * in the dark with everything else, and nothing in this city goes grey.
 */
export function neon(color, strength = 1.6, opacity = 1) {
  const key = `neon:${color}:${strength}:${opacity}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(color),
      emissiveIntensity: strength,
      roughness: 0.4,
      metalness: 0,
      toneMapped: true,
      transparent: opacity < 1,
      opacity,
    }));
  }
  return cache.get(key);
}

/**
 * A credit is lit like everything else and then handed most of its own light
 * back. It has to be spotted, reached and taken at twenty metres a second on
 * a deck the colour of a wet road, and a plain matte one simply is not there
 * in time.
 */
export function denomination(color, glow = 0.85) {
  return matte(color, { roughness: 0.34, metalness: 0.25, glow });
}

/**
 * Deck marking. Lit like the plate and then handed most of its own light
 * back, because in here the stripe has to be visible from forty metres in
 * the rain — which is the only reason anybody paints one.
 */
export function marking() {
  if (!cache.has('marking')) {
    cache.set('marking', new THREE.MeshStandardMaterial({
      color: 0x8a8a8a,
      map: texture('hazard'),
      emissive: 0xffffff,
      emissiveMap: texture('hazard'),
      emissiveIntensity: 0.55,
      roughness: 0.8,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }));
  }
  return cache.get('marking');
}

/** The pool a drone throws under itself, added to whatever it lands on. */
export function spill() {
  if (!cache.has('spill')) {
    cache.set('spill', new THREE.MeshBasicMaterial({
      map: pool(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    }));
  }
  return cache.get('spill');
}

/** The smudge under the egg. */
export function shade() {
  if (!cache.has('shade')) {
    cache.set('shade', new THREE.MeshBasicMaterial({
      map: blot(),
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      fog: false,
    }));
  }
  return cache.get('shade');
}

/** Unlit and flat, for what is too far down to be lit by anything up here. */
export function flat({ map = null, color = 0xffffff, vertexColors = false, opacity = 1 } = {}) {
  const key = `flat:${map}:${color}:${vertexColors}:${opacity}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshBasicMaterial({
      color,
      map: map ? texture(map) : null,
      vertexColors,
      transparent: opacity < 1,
      opacity,
    }));
  }
  return cache.get(key);
}
