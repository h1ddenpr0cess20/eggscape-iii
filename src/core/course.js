import { createRng, intBelow, range } from './rng.js';
import { AIRTIME, APEX, laneBounds, LANES, laneX, speedAt } from './tuning.js';

/** The approach starts behind the egg, so there is deck under it at t=0. */
const START_Z = -16;
const OPENING = 36;

/** Metres to full difficulty. */
const DIFFICULTY_RUN = 950;

/** A breach is a share of the reach a flat hop has at that speed — never more. */
const GAP_SHARE = { easy: 0.3, hard: 0.55 };
const GAP_MIN = 2.2;

/** A step up has to be comfortably under the apex, and over the landing snap. */
const STEP = { min: 0.7, max: APEX * 0.62 };

/** How far past a deck's edge the egg can still stand. */
export const EDGE_MARGIN = 0.25;

/** How many denominations the city pays in, and how many things it watches
 *  you with. The renderer keeps a mesh per kind; the course decides which is
 *  where, so a keycard stays a keycard on every frame and every replay. */
export const CREDIT_KINDS = 6;
export const CAM_KINDS = 3;

/** Decks never overlap in z, so there is never a wall to run into: miss a hop
 *  and you meet the canyon, which is a fair thing to lose to. */
export function createCourse({ seed = 1, difficultyRun = DIFFICULTY_RUN } = {}) {
  const rng = createRng(seed);

  const segments = [];
  const cams = [];
  const credits = [];

  let cursor = START_Z;
  let level = 0;
  let laid = 0;
  /** Ids never come round again — pruning shortens the array, and a renderer
   *  keyed on a reused id would put an old deck under a new one. */
  let nextId = 0;

  function difficulty() {
    return Math.min(1, Math.max(0, cursor / difficultyRun));
  }

  function reach() {
    return speedAt(Math.max(0, cursor)) * AIRTIME;
  }

  function gapLength(scale = 1) {
    const share = GAP_SHARE.easy + (GAP_SHARE.hard - GAP_SHARE.easy) * difficulty();
    return Math.max(GAP_MIN, reach() * share * range(rng, 0.85, 1.15) * scale);
  }

  function deck(length, { lane = 0, span = LANES, y = level } = {}) {
    const seg = {
      id: nextId++,
      z0: cursor,
      z1: cursor + length,
      y,
      lane,
      span,
      /** What is bolted to this one, decided once and for all. */
      dressing: intBelow(rng, 4),
      ...laneBounds(lane, span),
    };
    segments.push(seg);
    cursor = seg.z1;
    level = y;
    return seg;
  }

  function gap(length = gapLength()) {
    cursor += length;
    return length;
  }

  function cam(seg, z, lane) {
    cams.push({ z, lane, x: laneX(lane), y: seg.y, kind: intBelow(rng, CAM_KINDS), hit: false });
  }

  function credit(z, lane, y) {
    credits.push({ z, lane, x: laneX(lane), y, kind: intBelow(rng, CREDIT_KINDS), taken: false });
  }

  function line(seg, count, lane = seg.lane + intBelow(rng, seg.span), step = 2.4, from = 2) {
    const room = seg.z1 - seg.z0 - from - 1;
    const gapZ = Math.min(step, room / Math.max(1, count));
    for (let i = 0; i < count; i++) credit(seg.z0 + from + i * gapZ, lane, seg.y + 0.75);
    return lane;
  }

  /** A breather: flat, wide, and paid end to end. */
  function concourse() {
    line(deck(range(rng, 22, 32)), 5);
  }

  /** A patrol route: one lane watched at a time, and never the same one twice. */
  function patrol(d) {
    const rows = 2 + Math.round(d * 3);
    const seg = deck((rows + 1) * 6 + range(rng, 0, 6));
    let lane = intBelow(rng, LANES);
    for (let i = 1; i <= rows; i++) {
      const z = seg.z0 + (seg.z1 - seg.z0) * (i / (rows + 1));
      cam(seg, z, lane);
      credit(z + 1.8, (lane + 1 + intBelow(rng, LANES - 1)) % LANES, seg.y + 0.75);
      lane = (lane + 1 + intBelow(rng, LANES - 1)) % LANES;
    }
  }

  /** Deck plate missing, with an arc of credits over it to say how far. */
  function breach() {
    const before = deck(range(rng, 10, 16));
    const length = gap();
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      credit(before.z1 + length * t, 1, before.y + 0.9 + Math.sin(t * Math.PI) * 1.1);
    }
    line(deck(range(rng, 12, 20)), 3);
  }

  /** Bare structure over the canyon, one or two lanes wide. The run-up is the
   *  tell: there is no plate on it and nothing either side of it. */
  function girder(d) {
    deck(range(rng, 8, 12));
    const span = rng() < 0.35 + d * 0.4 ? 1 : 2;
    const lane = intBelow(rng, LANES - span + 1);
    gap(gapLength(0.7));
    const seg = deck(range(rng, 12, 20), { lane, span });
    const paid = line(seg, 5, lane + intBelow(rng, span), 2.6);
    if (span === 2 && d > 0.4) {
      cam(seg, seg.z0 + (seg.z1 - seg.z0) * 0.6, lane + (paid === lane ? 1 : 0));
    }
    deck(range(rng, 6, 10), { y: seg.y });
  }

  /** Up a tier, or back down to the one everybody else is on. Either way,
   *  over open air. */
  function tier(d) {
    const down = level > 0.4;
    gap(gapLength(down ? 0.8 : 0.55));
    const span = rng() < 0.5 ? LANES : 2;
    const lane = span === LANES ? 0 : intBelow(rng, LANES - 1);
    const seg = deck(range(rng, 14, 22), { y: down ? 0 : range(rng, STEP.min, STEP.max), lane, span });
    const paid = line(seg, 4, lane + intBelow(rng, span));
    if (d > 0.3 && span > 1) {
      const other = lane + ((paid - lane + 1) % span);
      cam(seg, seg.z0 + (seg.z1 - seg.z0) * 0.72, other);
    }
  }

  /** Checkpoint after checkpoint with exactly one lane unwatched — and the
   *  fare for using it standing in the middle of it. */
  function checkpoint(d) {
    const rows = 2 + Math.round(d * 2);
    const seg = deck((rows + 1) * 6.5 + range(rng, 0, 4));
    let open = intBelow(rng, LANES);
    for (let i = 1; i <= rows; i++) {
      const z = seg.z0 + (seg.z1 - seg.z0) * (i / (rows + 1));
      for (let lane = 0; lane < LANES; lane++) if (lane !== open) cam(seg, z, lane);
      credit(z, open, seg.y + 0.75);
      /** The way through never jumps more than a lane between checkpoints. */
      open = Math.max(0, Math.min(LANES - 1, open + (rng() < 0.5 ? -1 : 1)));
    }
  }

  function next() {
    if (laid++ === 0) {
      /**
       * The approach runs from sixteen metres behind the egg, and the credits
       * on it start in front of him — laid from the near end, the first two
       * come up between the camera and the shell and the title screen opens
       * on a keycard with an egg somewhere behind it.
       */
      line(deck(OPENING), 6, 1, 2.6, -START_Z + 2);
      return;
    }
    const d = difficulty();
    const roll = rng();
    if (roll < 0.18) concourse();
    else if (roll < 0.42) patrol(d);
    else if (roll < 0.62) breach(d);
    else if (roll < 0.78) girder(d);
    else if (roll < 0.9) tier(d);
    else checkpoint(d);
  }

  return {
    segments,
    cams,
    credits,

    get end() { return cursor; },

    /** Lay city until it reaches z. */
    ensure(z) {
      while (cursor < z) next();
      return this;
    },

    /** The deck under a point, or null over the canyon. */
    groundAt(x, z) {
      let lo = 0;
      let hi = segments.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = segments[mid];
        if (z < seg.z0) hi = mid - 1;
        else if (z >= seg.z1) lo = mid + 1;
        else return x >= seg.xMin - EDGE_MARGIN && x <= seg.xMax + EDGE_MARGIN ? seg : null;
      }
      return null;
    },

    /** Where a fallen egg is put back: the first deck still ahead of it. */
    landingAfter(z) {
      for (const seg of segments) if (seg.z0 > z) return seg;
      return null;
    },

    /** Everything behind the egg is scenery nobody will look at again. */
    prune(z) {
      while (segments.length > 1 && segments[0].z1 < z) segments.shift();
      while (cams.length && cams[0].z < z) cams.shift();
      while (credits.length && credits[0].z < z) credits.shift();
    },
  };
}
