import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CAM_KINDS, CREDIT_KINDS, createCourse } from '../src/core/course.js';
import { APEX, AIRTIME, laneBounds, LANES, LANE_WIDTH, laneX, speedAt } from '../src/core/tuning.js';

const SEEDS = [1, 2, 3, 7, 42, 1024, 65535];

function laidOut(seed, until = 1400) {
  return createCourse({ seed }).ensure(until);
}

describe('course', () => {
  it('lays the same course for the same seed, and a different one otherwise', () => {
    const a = laidOut(9).segments.map((s) => [s.z0, s.z1, s.y, s.lane, s.span].join());
    const b = laidOut(9).segments.map((s) => [s.z0, s.z1, s.y, s.lane, s.span].join());
    const c = laidOut(10).segments.map((s) => [s.z0, s.z1, s.y, s.lane, s.span].join());
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
  });

  it('starts with deck under the egg and an approach in front of it', () => {
    for (const seed of SEEDS) {
      const course = laidOut(seed);
      const start = course.groundAt(0, 0);
      assert.ok(start, `seed ${seed} has nothing under the spawn`);
      assert.equal(start.y, 0);
      assert.ok(start.z0 < 0, 'the approach should begin behind the egg');
      assert.ok(start.z1 > 12, 'and give it room before anything happens');
    }
  });

  it('never overlaps two decks in z — there is no wall to run into', () => {
    for (const seed of SEEDS) {
      const { segments } = laidOut(seed);
      for (let i = 1; i < segments.length; i++) {
        assert.ok(
          segments[i].z0 >= segments[i - 1].z1 - 1e-9,
          `seed ${seed}: deck ${i} starts inside the one before it`,
        );
      }
    }
  });

  it('never opens a breach wider than the hop that has to clear it', () => {
    for (const seed of SEEDS) {
      const { segments } = laidOut(seed);
      for (let i = 1; i < segments.length; i++) {
        const gap = segments[i].z0 - segments[i - 1].z1;
        if (gap <= 0) continue;
        const reach = speedAt(segments[i - 1].z1) * AIRTIME;
        assert.ok(gap < reach * 0.72, `seed ${seed}: ${gap.toFixed(2)}m gap against ${reach.toFixed(2)}m of reach`);
      }
    }
  });

  it('never steps up further than a jump can rise', () => {
    for (const seed of SEEDS) {
      const { segments } = laidOut(seed);
      for (let i = 1; i < segments.length; i++) {
        const rise = segments[i].y - segments[i - 1].y;
        assert.ok(rise < APEX * 0.7, `seed ${seed}: a ${rise.toFixed(2)}m step against a ${APEX.toFixed(2)}m apex`);
        assert.ok(segments[i].y >= 0, 'decks never sit below the walkway');
      }
    }
  });

  it('keeps every deck inside the three lanes', () => {
    for (const seed of SEEDS) {
      for (const seg of laidOut(seed).segments) {
        assert.ok(seg.span >= 1 && seg.span <= LANES);
        assert.ok(seg.lane >= 0 && seg.lane + seg.span <= LANES);
        const { xMin, xMax } = laneBounds(seg.lane, seg.span);
        assert.equal(seg.xMin, xMin);
        assert.equal(seg.xMax, xMax);
        assert.ok(seg.xMin < seg.xMax, 'a deck whose edges came out the wrong way round');
        assert.equal(seg.xMax - seg.xMin, seg.span * LANE_WIDTH);
      }
    }
  });

  it('posts every cam on a deck, in a lane, and never watches all three', () => {
    for (const seed of SEEDS) {
      const course = laidOut(seed);
      const rows = new Map();
      for (const cam of course.cams) {
        assert.ok(course.groundAt(cam.x, cam.z), `seed ${seed}: a cam floating over the canyon`);
        assert.equal(cam.x, laneX(cam.lane));
        const key = cam.z.toFixed(3);
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }
      for (const [z, count] of rows) {
        assert.ok(count < LANES, `seed ${seed}: every lane watched at z=${z}`);
      }
    }
  });

  it('puts credits in reach — on a deck, or arcing over a breach it wants hopped', () => {
    for (const seed of SEEDS) {
      const course = laidOut(seed);
      for (const credit of course.credits) {
        assert.ok(Math.abs(credit.x) <= LANE_WIDTH, 'a credit outside the lanes');
        const over = course.groundAt(credit.x, credit.z);
        if (over) assert.ok(credit.y - over.y < APEX, 'a credit above the apex');
        else assert.ok(credit.y > 0, 'a credit over the canyon should still be an arc');
      }
    }
  });

  /** The renderer keeps one pool of meshes per kind and indexes straight into
   *  it, so a kind out of range is a credit that never gets drawn. */
  it('mints a kind the renderer has a mesh for, and dresses every deck', () => {
    for (const seed of SEEDS) {
      const course = laidOut(seed);
      for (const credit of course.credits) {
        assert.ok(Number.isInteger(credit.kind) && credit.kind >= 0 && credit.kind < CREDIT_KINDS,
          `seed ${seed}: a credit of kind ${credit.kind}`);
      }
      for (const cam of course.cams) {
        assert.ok(Number.isInteger(cam.kind) && cam.kind >= 0 && cam.kind < CAM_KINDS,
          `seed ${seed}: a cam of kind ${cam.kind}`);
      }
      for (const seg of course.segments) {
        assert.ok(Number.isInteger(seg.dressing), `seed ${seed}: an undressed deck`);
      }
    }
  });

  it('grows only as far as it is asked to, and keeps growing', () => {
    const course = createCourse({ seed: 5 });
    course.ensure(200);
    assert.ok(course.end >= 200);
    const first = course.segments.length;
    course.ensure(200);
    assert.equal(course.segments.length, first, 'ensure past the end lays nothing new');
    course.ensure(600);
    assert.ok(course.segments.length > first);
  });

  it('drops what is behind without disturbing what is ahead', () => {
    const course = laidOut(3, 600);
    const ahead = course.segments.filter((s) => s.z1 >= 300).length;
    course.prune(300);
    assert.equal(course.segments.filter((s) => s.z1 >= 300).length, ahead);
    assert.ok(course.segments.every((s) => s.z1 >= 300 || s === course.segments[0]));
    assert.ok(course.credits.every((c) => c.z >= 300));
    assert.ok(course.cams.every((c) => c.z >= 300));
  });

  it('answers what is underfoot, and what is not', () => {
    const course = createCourse({ seed: 1 }).ensure(100);
    const seg = course.segments[0];
    assert.equal(course.groundAt(0, seg.z0 + 1)?.id, seg.id);
    assert.equal(course.groundAt(0, seg.z0 - 0.5), null, 'nothing before the approach');
    assert.equal(course.groundAt(40, seg.z0 + 1), null, 'nothing that far out to the side');
  });

  it('always has somewhere to put a fallen egg back down', () => {
    const course = laidOut(7);
    for (let z = 0; z < 900; z += 37) {
      const landing = course.landingAfter(z);
      assert.ok(landing, `nothing to respawn onto past ${z}`);
      assert.ok(landing.z0 > z);
    }
  });
});
