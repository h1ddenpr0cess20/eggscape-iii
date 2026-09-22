import * as THREE from 'three';

import { CAM_KINDS, CREDIT_KINDS } from '../core/course.js';
import { approach, clamp, spring } from '../core/motion.js';
import { laneX, PLAYER } from '../core/tuning.js';
import { createCredit } from './credits.js';
import { createEgg, createShadow, EGG_SCALE } from './egg.js';
import { createCam, createCity, createDeck, disposeDeck } from './props.js';
import { focus as aimAt, rigFor, seat } from './rig.js';

const CHASE = 6;
const DRAW = { behind: 12, ahead: 130 };
/** How hard the shell rocks while it runs, and how fast. */
const ROCK = { amount: 0.075, speed: 11, lean: 0.12, spin: 0.5 };

/**
 * The squash spring, and the step it is integrated at. It is explicit Euler,
 * so a long frame does not slow it down — it blows it up: one 250ms hitch and
 * the shell pins at its limits and stays there, wobbling between a pancake and
 * a capsule. Sub-stepping is the whole fix, and it matters because the
 * silhouette is the asset.
 */
const SQUASH = { k: 190, c: 11, step: 1 / 120, max: 0.4, stretch: -0.08 };

/** Where a drone hovers when it is not bobbing. */
const CAM_LIFT = 0.95 * 0.52;

function createPool(scene, make) {
  const items = [];
  let cursor = 0;

  return {
    begin() { cursor = 0; },
    take() {
      let item = items[cursor];
      if (!item) {
        item = make();
        items[cursor] = item;
        scene.add(item);
      }
      item.visible = true;
      cursor += 1;
      return item;
    },
    end() { for (let i = cursor; i < items.length; i++) items[i].visible = false; },
  };
}

/**
 * A pool per kind. A keycard and a drone are different objects, and the
 * course decided at generation time which one is where — so the renderer
 * takes from the right pool rather than ever turning one into the other,
 * which is what keeps the walkway from flickering between denominations.
 */
function createPools(scene, count, make) {
  return Array.from({ length: count }, (_, kind) => createPool(scene, () => make(kind)));
}

/**
 * The one place that knows both the game and the scene graph. Everything it
 * draws is derived from a snapshot — it holds no state the run depends on, so
 * a restart is a `reset()` and nothing more.
 */
export function createView({ scene, camera, studio }) {
  const egg = createEgg();
  const shadow = createShadow();
  const city = createCity();
  scene.add(egg.object, shadow, city.object);

  const decks = new Map();
  const cams = createPools(scene, CAM_KINDS, createCam);
  const credits = createPools(scene, CREDIT_KINDS, createCredit);

  const squash = { p: 0, v: 0 };
  const target = new THREE.Vector3();
  const aim = new THREE.Vector3();

  let level = 0;
  let placed = false;
  let tumble = 0;
  let shake = 0;

  function syncDecks(course) {
    const live = new Set();
    for (const seg of course.segments) {
      live.add(seg.id);
      if (decks.has(seg.id)) continue;
      const deck = createDeck(seg);
      decks.set(seg.id, deck);
      scene.add(deck);
    }
    for (const [id, deck] of decks) {
      if (live.has(id)) continue;
      scene.remove(deck);
      disposeDeck(deck);
      decks.delete(id);
    }
  }

  function syncProps(course, player, time) {
    for (const pool of cams) pool.begin();
    for (const cam of course.cams) {
      if (cam.hit || cam.z < player.z - DRAW.behind) continue;
      if (cam.z > player.z + DRAW.ahead) break;
      const mesh = cams[cam.kind % cams.length].take();
      mesh.position.set(cam.x, cam.y, cam.z);

      /**
       * It is watching, and it is worth being able to tell that it is. A cam
       * sweeps its lane until the egg is close enough to be worth turning
       * towards, and then it turns — which is the only warning the player
       * gets that this one is live and the last one was already behind them.
       */
      const range = cam.z - player.z;
      const near = clamp(1 - range / 26, 0, 1);
      const { head, lens } = mesh.userData;
      if (head) {
        const sweep = Math.sin(time * 1.3 + cam.z) * 0.7;
        const onto = Math.atan2(cam.x - player.x, Math.max(range, 0.5));
        head.rotation.y = sweep * (1 - near) + onto * near;
        /** A drone does not stand still while it does it. */
        if (cam.kind === 1) head.position.y = CAM_LIFT + Math.sin(time * 4.4 + cam.z) * 0.06;
      }
      if (lens) {
        lens.material.emissiveIntensity = 1.5 + near * 1.6 + Math.sin(time * 9 + cam.z) * 0.25 * near;
      }
    }
    for (const pool of cams) pool.end();

    for (const pool of credits) pool.begin();
    for (const credit of course.credits) {
      if (credit.taken || credit.z < player.z - DRAW.behind) continue;
      if (credit.z > player.z + DRAW.ahead) break;
      const mesh = credits[credit.kind % credits.length].take();
      mesh.position.set(credit.x, credit.y + Math.sin(time * 2.6 + credit.z) * 0.12, credit.z);
      mesh.rotation.set(0, time * 1.5 + credit.z, Math.sin(time * 1.9 + credit.z) * 0.1);
    }
    for (const pool of credits) pool.end();
  }

  function syncEgg(snapshot, dt, time) {
    const { player, state, invulnerable } = snapshot;

    for (let left = Math.min(dt, 0.25); left > 0; left -= SQUASH.step) {
      spring(squash, SQUASH.k, SQUASH.c, Math.min(SQUASH.step, left), 0);
    }
    /**
     * Squash freely, stretch barely. The rebound of a landing used to pull the
     * shell into a capsule, and a stretched egg is not an egg — the silhouette
     * is the asset, so the spring is only allowed to flatten it.
     */
    const s = clamp(squash.p, SQUASH.stretch, SQUASH.max);

    egg.object.position.set(player.x, player.y + PLAYER.height / 2, player.z);
    /** The neon travels with the shell, so the light on it never drifts. */
    studio?.position.set(player.x, player.y, player.z);
    egg.object.scale.set(1 + s * 0.4, 1 - s, 1 + s * 0.4);
    egg.object.scale.multiplyScalar(EGG_SCALE);

    /**
     * The shell stays upright. An egg tumbling end over end is a shape you
     * cannot read — half the time it is pointing at you — and the silhouette,
     * fat end down, is the whole asset. So it rocks and it turns on the spot,
     * the way Marc does, and leans into the lane it is moving to.
     */
    const running = state === 'running';
    const rock = running && player.grounded ? Math.sin(time * ROCK.speed) * ROCK.amount : 0;
    const drift = clamp((laneX(player.lane) - player.x) * -0.4, -0.35, 0.35);

    egg.object.rotation.set(
      running ? ROCK.lean + (player.grounded ? 0 : -0.1) : 0,
      egg.object.rotation.y + (running ? dt * ROCK.spin : 0),
      rock + drift,
    );

    if (state === 'ready') {
      /** Nothing is running yet, so the egg does what Marc does: it rocks. */
      egg.object.position.y += Math.sin(time * 1.4) * 0.05;
      egg.object.rotation.z = Math.sin(time * 0.9) * 0.09;
      egg.object.rotation.y = time * 0.35;
    }

    if (state === 'over') {
      tumble += dt;
      egg.object.position.y -= tumble * tumble * 4;
      egg.object.rotation.z += tumble * 2.2;
    } else {
      tumble = 0;
    }

    /** Invulnerable is a blink, not a tint — the materials are shared. */
    egg.body.visible = invulnerable <= 0 || Math.floor(time * 16) % 2 === 0;
  }

  function syncShadow(course, player) {
    const ground = course.groundAt(player.x, player.z);
    shadow.visible = Boolean(ground);
    if (!ground) return;
    const height = Math.max(0, player.y - ground.y);
    shadow.position.set(player.x, ground.y + 0.03, player.z);
    shadow.scale.setScalar(clamp(1 - height * 0.08, 0.45, 1.05));
    shadow.material.opacity = clamp(0.95 - height * 0.12, 0.25, 0.95);
  }

  return {
    /** A landing, a pickup and a hit all read as a kick in the springs. */
    kick(force) { squash.v += force; },
    jolt(force) { shake = Math.min(1, shake + force); },

    reset() {
      for (const [id, deck] of decks) {
        scene.remove(deck);
        disposeDeck(deck);
        decks.delete(id);
      }
      squash.p = 0;
      squash.v = 0;
      tumble = 0;
      shake = 0;
      level = 0;
      placed = false;
    },

    /**
     * Cut to the egg rather than chase it. A respawn puts it down metres
     * further on, and a camera that eases after it spends a second with the
     * egg off the top of the frame — running blind, on a walkway that is not
     * waiting.
     */
    snap() { placed = false; },

    sync(snapshot, dt, time) {
      const { course, player } = snapshot;

      syncDecks(course);
      syncProps(course, player, time);
      syncEgg(snapshot, dt, time);
      syncShadow(course, player);

      city.object.position.z = Math.round(player.z / city.spacing) * city.spacing;

      if (player.grounded) level = approach(level, player.y, 6, dt);
      shake = approach(shake, 0, 6, dt);

      const rig = rigFor(camera.aspect);
      seat(target, player, level, rig, shake);
      if (placed) camera.position.lerp(target, 1 - Math.exp(-dt * CHASE));
      else {
        camera.position.copy(target);
        placed = true;
      }

      camera.lookAt(aimAt(aim, player, level, rig));
    },
  };
}
