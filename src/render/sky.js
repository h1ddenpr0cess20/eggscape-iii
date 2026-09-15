import * as THREE from 'three';

const WIDTH = 1024;
const HEIGHT = 512;

/** How fast the weather goes over: a full turn in half an hour, which is
 *  nothing in a frame and everything in a run. */
const DRIFT = 0.0035;

/**
 * The sky, painted once and hung on a sphere the camera sits inside.
 *
 * It is a dome rather than `scene.background`, which is not fussiness: three
 * runs an equirectangular background through PMREM, and PMREM is a blur — it
 * drags whatever is bright down into the haze and leaves a seam lying across
 * the horizon in every frame. Owning the sphere costs forty triangles and
 * samples the canvas exactly as it was painted. It is also why there is
 * parallax at all: a texture pinned to the frame cannot lean when the camera
 * does, and a sky that never moves gives a backdrop away as a backdrop.
 *
 * There are no stars worth painting. The band at the horizon is the city
 * throwing its own light back at itself, and it is the same colour as the
 * fog — which is what lets the far end of the walkway dissolve into it
 * rather than stop dead against it.
 */
export function createSky({ random = Math.random } = {}) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const horizon = HEIGHT * 0.52;

  const air = ctx.createLinearGradient(0, 0, 0, horizon);
  air.addColorStop(0, '#02030a');
  air.addColorStop(0.42, '#070b18');
  air.addColorStop(0.76, '#0d1526');
  air.addColorStop(0.95, '#101a2e');
  air.addColorStop(1, '#101a2e');
  ctx.fillStyle = air;
  ctx.fillRect(0, 0, WIDTH, horizon);

  /** Under the horizon is haze, and it stays haze for a good way down: the
   *  city is down there and it fades into the fog as it goes, so wherever
   *  the two meet the backdrop has to be the fog's own colour. */
  const below = ctx.createLinearGradient(0, horizon, 0, HEIGHT);
  below.addColorStop(0, '#101a2e');
  below.addColorStop(0.45, '#101a2e');
  below.addColorStop(1, '#070c16');
  ctx.fillStyle = below;
  ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);

  /**
   * A few thousand windows too far away to be anything but a smear, low on
   * the horizon. They are drawn faint and few on purpose: a radial gradient
   * whose radius is far wider than the ellipse it fills is very nearly a
   * solid, and forty of those laid across a thousand pixels does not read as
   * a city glowing — it repaints the whole sky the colour of the glow.
   */
  for (let i = 0; i < 16; i++) {
    const x = random() * WIDTH;
    const w = 50 + random() * 130;
    const h = 14 + random() * 26;
    const warm = random() < 0.55;
    const g = ctx.createRadialGradient(x, horizon, 0, x, horizon, w);
    const hue = warm ? '255,150,70' : (random() < 0.5 ? '255,47,158' : '47,230,255');
    g.addColorStop(0, `rgba(${hue},${0.05 + random() * 0.07})`);
    g.addColorStop(0.5, `rgba(${hue},${0.02 + random() * 0.03})`);
    g.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, horizon - h * 0.2, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Cloud, lit from underneath by all of it. Kept off the horizon: down there
   * a cloud stops reading as weather and starts reading as a seam, and the
   * camera only ever sees about twenty degrees of sky anyway.
   */
  for (let i = 0; i < 46; i++) {
    const t = random();
    const y = horizon * (0.08 + t * 0.66);
    const w = 40 + random() * 170 * (1 - t * 0.4);
    const h = w * (0.16 + random() * 0.14);
    const lift = 1 - y / horizon;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    const glow = random() < 0.28 ? '190,80,130' : '90,115,165';
    g.addColorStop(0, `rgba(${glow},${0.03 + (1 - lift) * 0.09})`);
    g.addColorStop(0.6, `rgba(30,42,68,${0.05 + (1 - lift) * 0.08})`);
    g.addColorStop(1, 'rgba(8,11,20,0)');
    ctx.save();
    ctx.translate(random() * WIDTH, y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      depthTest: false,
    }),
  );
  dome.name = 'sky';
  /** Drawn before anything else and never written to the depth buffer, so
   *  the city lands on top of it whatever order the rest arrives in. */
  dome.renderOrder = -1000;
  dome.frustumCulled = false;

  return {
    object: dome,

    /** The dome rides with the camera — it has no distance of its own — and
     *  turns while it does, which is the weather going over. */
    update(dt, camera) {
      dome.position.copy(camera.position);
      dome.rotation.y = (dome.rotation.y + dt * DRIFT) % (Math.PI * 2);
    },
  };
}
