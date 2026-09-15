import * as THREE from 'three';

/**
 * Rain, as line segments in a box that travels with the camera.
 *
 * The first of these had rain that was not rain — glyphs falling down a
 * canvas, because what was falling was the world. This is the literal
 * version, and it is the cheapest weather there is: one geometry, one draw,
 * and a position array walked on the CPU once a frame.
 *
 * Each streak falls at its own speed and wraps when it reaches the floor of
 * the box, so the box never empties and nothing has to be allocated again.
 */

const COUNT = 900;
const BOX = { x: 34, y: 26, z: 70 };
const FALL = { min: 34, max: 58 };
/** Wind, and the length of a drop at this shutter speed. */
const SLANT = 0.1;
const STREAK = 0.85;

export function createRain({ random = Math.random } = {}) {
  const position = new Float32Array(COUNT * 6);
  const speed = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    speed[i] = FALL.min + random() * (FALL.max - FALL.min);
    const x = (random() - 0.5) * BOX.x;
    const y = random() * BOX.y;
    const z = (random() - 0.5) * BOX.z;
    position.set([x, y, z, x + SLANT * STREAK, y - STREAK, z], i * 6);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));

  const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0x9fd8ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    fog: true,
  }));
  object.name = 'rain';
  object.frustumCulled = false;

  return {
    object,

    /**
     * The box is re-centred on the camera every frame rather than the drops
     * being chased across the world — at twenty-four metres a second the egg
     * outruns any rain that has a fixed address.
     */
    update(dt, camera) {
      object.position.set(camera.position.x, camera.position.y - BOX.y * 0.35, camera.position.z + BOX.z * 0.25);

      for (let i = 0; i < COUNT; i++) {
        const at = i * 6;
        let y = position[at + 1] - speed[i] * dt;
        if (y < -BOX.y * 0.5) {
          y = BOX.y * 0.5;
          position[at] = (Math.random() - 0.5) * BOX.x;
          position[at + 2] = (Math.random() - 0.5) * BOX.z;
          position[at + 3] = position[at] + SLANT * STREAK;
          position[at + 5] = position[at + 2];
        }
        position[at + 1] = y;
        position[at + 4] = y - STREAK;
      }

      geometry.attributes.position.needsUpdate = true;
    },
  };
}
