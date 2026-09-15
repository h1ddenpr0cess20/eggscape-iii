import * as THREE from 'three';

/**
 * The city, as a cube map: near-black above, the ground glow below, and two
 * patches of neon at eye level. Every standard material in here samples it,
 * which is what stops the shaded side of a cam going to absolute black — and
 * it is also what lights Marc's shell, in place of the studio he came out of.
 */
export function buildEnvironment(scene, renderer) {
  try {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, '#04060e');
    g.addColorStop(0.44, '#101a2e');
    g.addColorStop(0.54, '#1b2740');
    g.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 32);

    /** The two colours this city is lit by, and nothing in between. */
    for (const [x, hue] of [[14, '47,230,255'], [46, '255,47,158']]) {
      const spot = ctx.createRadialGradient(x, 17, 0, x, 17, 13);
      spot.addColorStop(0, `rgba(${hue},0.85)`);
      spot.addColorStop(1, `rgba(${hue},0)`);
      ctx.fillStyle = spot; ctx.fillRect(x - 14, 3, 28, 28);
    }

    const tex = new THREE.Texture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose(); tex.dispose();
  } catch {
  }
}

/**
 * Two neons and whatever is left of the sky.
 *
 * Marc's studio had a neutral key and a warm fill. This is the same rig with
 * the money taken out of it: the key is cold and weak and comes off the
 * overcast, and the two lights that actually describe him are a cyan and a
 * magenta from opposite sides — which is the only reason a cream eggshell
 * reads as being somewhere rather than as a pale blob in the dark.
 *
 * The rig travels with the egg, which costs nothing — a directional light has
 * a direction and no place — and means the shell is lit the same forty
 * storeys up as it is at the turnstile.
 */
export function buildLights(scene) {
  const rig = new THREE.Group();
  rig.name = 'nightlight';

  const sky = new THREE.HemisphereLight(0x20304e, 0x080b14, 0.55);

  /**
   * The key sits behind the camera and is very slightly warm, which is the
   * whole trick: it lights the face of the shell the player is actually
   * looking at, so he keeps his own colour.
   *
   * Put the key up and to the side instead and the neon takes the near face
   * by default — the egg comes out teal on one side and pink on the other,
   * and the only warm thing in the city stops being warm.
   */
  const key = new THREE.DirectionalLight(0xfff0dc, 1.35);
  key.position.set(-3, 6, -8);

  const top = new THREE.DirectionalLight(0xbcd2ee, 0.95);
  top.position.set(4, 10, 2);

  /** The two colours the city is lit by, low and from the sides, where they
   *  catch an edge instead of painting a face. */
  const cyan = new THREE.DirectionalLight(0x2fe6ff, 0.46);
  cyan.position.set(-9, 1.2, 3);

  const magenta = new THREE.DirectionalLight(0xff2f9e, 0.3);
  magenta.position.set(9, 1, 5);

  rig.add(sky, key, key.target, top, top.target, cyan, cyan.target, magenta, magenta.target);
  scene.add(rig);
  return rig;
}
