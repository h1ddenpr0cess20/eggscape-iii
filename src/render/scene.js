import * as THREE from 'three';

import { buildEnvironment, buildLights } from './nightlight.js';
import { createRain } from './rain.js';
import { createSky } from './sky.js';
import { THEME } from './theme.js';

/**
 * Renderer, camera, haze, sky and weather. Almost nothing in the city emits
 * its own light and the little that does is the entire look, so the exposure
 * and the fog are not finishing touches here — they are the art direction.
 */
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(THEME.haze, 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  /** Under one, because everything worth seeing in here is emissive and ACES
   *  will happily roll a neon tube all the way to white. */
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(THEME.haze, 34, 150);

  /** 52°, not the 64° this started on: a wide lens stretches whatever sits
   *  away from the middle of the frame, and what sits there is the egg. */
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 420);
  camera.position.set(0, 3.2, -8.4);

  const studio = buildLights(scene);
  buildEnvironment(scene, renderer);

  const sky = createSky();
  if (sky) {
    /** Big enough to sit outside the city's business and small enough to stay
     *  inside the far plane: it travels with the camera, so its radius is
     *  only ever a number the projection has to swallow. */
    sky.object.scale.setScalar(340);
    scene.add(sky.object);
  }

  const rain = createRain();
  scene.add(rain.object);

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /** A tall window needs a taller lens, or the walkway shrinks to a thread. */
    camera.fov = camera.aspect < 1 ? 64 : 52;
    camera.updateProjectionMatrix();
  }

  resize();
  addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    studio,
    resize,
    tick(dt) {
      sky?.update(dt, camera);
      rain.update(dt, camera);
    },
    render() { renderer.render(scene, camera); },
  };
}
