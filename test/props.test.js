import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANES, laneBounds } from '../src/core/tuning.js';
import { linear } from '../src/gpu/color.js';
import { createCam, createDeck, disposeDeck } from '../src/render/props.js';
import { THEME } from '../src/render/theme.js';

/** A deck wide enough and long enough to be dressed, at the given id. */
function deck(id, dressing = 0) {
  return {
    id, z0: id * 40, z1: id * 40 + 24, y: 0, lane: 0, span: LANES, dressing,
    ...laneBounds(0, LANES),
  };
}

const sign = (group) => group.getObjectByName('hoarding');

/** Whether a geometry's buffers were freed while `run` was running. */
function freed(geometry, run) {
  let fired = false;
  const listen = () => { fired = true; };
  geometry.addEventListener('dispose', listen);
  run();
  geometry.removeEventListener('dispose', listen);
  return fired;
}

describe('decks', () => {
  it('dresses a wide deck with a railing and a hoarding', () => {
    const group = createDeck(deck(1));
    assert.ok(group.getObjectByName('railing'), 'no railing down the side of it');
    assert.ok(sign(group), 'nothing selling anything at you');
  });

  it('frees the geometry it built for itself', () => {
    const group = createDeck(deck(2));
    const railing = group.getObjectByName('railing');
    assert.ok(freed(railing.geometry, () => disposeDeck(group)), 'the railing kept its buffers');
  });

  /**
   * There are eight slogans and a run lays hundreds of decks, so a hoarding
   * is painted once and every later copy of it is a clone off that pattern.
   * Two decks carrying the same slogan therefore carry the same buffers —
   * and pulling one down must not take the other's with it.
   */
  it('paints one board per slogan rather than one per deck', () => {
    const mine = sign(createDeck(deck(3)));
    const yours = sign(createDeck(deck(3 + 8)));
    const panel = (group) => group.children[0];
    assert.equal(panel(mine).material, panel(yours).material, 'the same slogan was painted twice');
    assert.equal(panel(mine).geometry, panel(yours).geometry, 'the same board was built twice');
  });

  it('leaves the board it shares with every other deck alone', () => {
    const mine = createDeck(deck(5));
    const yours = createDeck(deck(5 + 8));
    const shared = sign(yours).children[0].geometry;
    assert.ok(!freed(shared, () => disposeDeck(mine)), 'one deck took every hoarding with it');
  });
});

describe('cams', () => {
  /**
   * Red is the colour of being seen, and a cam has to be readable as a cam
   * from forty metres: every kind looks down the lane with a red cone and
   * carries a red tally light. Each cam's are its own — the renderer animates
   * them per cam, and shared materials would blink the whole field at once.
   */
  it('gives every kind a red gaze and tally light of its own', () => {
    const red = linear(THEME.alert);
    for (const kind of [0, 1, 2]) {
      const one = createCam(kind).userData;
      const two = createCam(kind).userData;
      assert.ok(one.gaze && one.tally, `kind ${kind} is missing its tells`);
      assert.deepEqual(one.gaze.material.color, red);
      assert.deepEqual(one.tally.material.emissive, red);
      assert.notEqual(one.gaze.material, two.gaze.material, `kind ${kind} shares its gaze`);
      assert.notEqual(one.tally.material, two.tally.material, `kind ${kind} shares its tally`);
    }
  });

  it('points the gaze back down the lane, at the egg coming the other way', () => {
    for (const kind of [0, 1, 2]) {
      const { gaze } = createCam(kind).userData;
      const p = gaze.geometry.position;
      const far = Math.min(...Array.from({ length: p.length / 3 }, (_, i) => p[i * 3 + 2]));
      assert.ok(far < -2, `kind ${kind} looks the wrong way`);
      assert.ok(gaze.rotation.x < 0, `kind ${kind} looks up instead of at the deck`);
    }
  });
});
