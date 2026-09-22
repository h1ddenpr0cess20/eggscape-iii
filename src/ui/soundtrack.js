import { hit, hold, rest, shape } from './music.js';

/**
 * Eggscape the Permanent Underclass: darksynth for the shift, and hold music
 * for the time between shifts.
 *
 * The shift is F minor at a walking pace that will not let you walk: a kick
 * on every beat, a bass pumping sixteenths under it, and over the top a brass
 * section made of saws, the way the last century imagined this one would
 * sound. Fm Fm Db Db Bbm Bbm C C, and the C is major, so every eight bars it
 * almost resolves and then does not.
 *
 * Between shifts it is C major, an electric piano and a vibraphone, and a
 * tape that has been played to a great many people who were told their call
 * was important. It is the only thing in the city in a major key, and it is
 * the thing you hear while nothing happens. It rains through both.
 */

const CHORDS = [
  { root: 'f2', brass: 'f3+ab3+c4', arp: ['f4', 'ab4', 'c5', 'ab4'] },
  { root: 'db2', brass: 'f3+ab3+db4', arp: ['f4', 'ab4', 'db5', 'ab4'] },
  { root: 'bb1', brass: 'f3+bb3+db4', arp: ['f4', 'bb4', 'db5', 'bb4'] },
  { root: 'c2', brass: 'e3+g3+c4', arp: ['e4', 'g4', 'c5', 'g4'] },
];

/** Two bars to a chord. */
const each = (write) => CHORDS.map((chord) => `${write(chord)} | ${write(chord)}`).join(' | ');
const across = (write) => CHORDS.map(write).join(' | ');

/** Sixteenths, leaning on the beat and falling off it — a pump, without the
 *  sidechain. */
const pulse = ({ root }) => Array.from({ length: 4 }, () => `${root}! ${root}? ${root} ${root}?`).join(' ');
const climb = ({ arp }) => Array.from({ length: 16 }, (_, i) => arp[i % 4]).join(' ');

const LEAD = [
  'f4 - - - c5 - - - ab4 - - - g4 - f4 -',
  'g4 - - - - - - - c4 - - - - - - -',
  'f4 - - - db5 - - - c5 - - - ab4 - f4 -',
  'ab4 - - - - - - - - - - - . . . .',
  'bb4 - - - db5 - - - f5 - - - db5 - bb4 -',
  'c5 - - - - - - - db5 - - - c5 - bb4 -',
  'c5 - - - e5 - - - g5 - - - e5 - c5 -',
  'b4 - - - - - - - c5 - - - - - - -',
].join(' | ');

/** The rain never stops, so it is one long note to a phrase. */
const RAIN = hold('x', 32);

const HOLD = [
  { root: 'c2', fifth: 'g2', keys: 'e3+g3+b3+d4' },
  { root: 'a1', fifth: 'e2', keys: 'e3+g3+c4' },
  { root: 'd2', fifth: 'a1', keys: 'f3+a3+c4+e4' },
  { root: 'g1', fifth: 'd2', keys: 'f3+b3+d4' },
];
const twice = (write) => [...HOLD, ...HOLD].map(write).join(' | ');
const VIBES = [
  'e5 - - - g5 - - - d5 - - - - - - -',
  'c5 - - - e5 - - - b4 - - - - - - -',
  'a4 - - - c5 - - - f5 - - - e5 - d5 -',
  'd5 - - - - - - - b4 - - - - - - -',
  'e5 - - - g5 - - - b5 - - - a5 - g5 -',
  'a5 - - - g5 - - - e5 - - - - - - -',
  'f5 - - - e5 - - - d5 - - - c5 - a4 -',
  /** It does not come home. Please continue to hold. */
  'b4 - - - - - - - . . . . . . . .',
].join(' | ');

function instruments({ voice }) {
  let lastLead = null;

  /** Two sines, one bending the other: the whole of an electric piano and
   *  most of a bell, depending on the ratio. */
  function fm(out, t, freq, { ratio, index, fall, peak, ring, sustain = 0, warble = 0, tremolo = 0 }) {
    const note = voice(t);
    const carrier = note.osc('sine', freq);
    const mod = note.osc('sine', freq * ratio);
    const depth = note.gain(index * freq);
    depth.gain.setTargetAtTime(index * freq * 0.15, t, fall / 3);
    mod.connect(depth).connect(carrier.frequency);
    if (warble) note.wobble(carrier.detune, 0.7, warble);
    const amp = note.gain();
    if (tremolo) note.wobble(amp.gain, 5.5, peak * tremolo, 0.1);
    carrier.connect(amp).connect(out);
    note.play(shape(amp.gain, t, ring, { peak, attack: 0.003, decay: ring, sustain, release: 0.35 }));
  }

  return {
    kick(out, t, _dur, _freqs, vel) {
      const note = voice(t);
      const body = note.osc('sine', 130);
      body.frequency.exponentialRampToValueAtTime(38, t + 0.14);
      const amp = note.gain();
      body.connect(amp).connect(out);
      const click = note.noise();
      const bite = note.filter('highpass', 2400);
      const clickAmp = note.gain();
      click.connect(bite).connect(clickAmp).connect(out);
      hit(clickAmp.gain, t, 0.015, 0.25 * vel);
      note.play(hit(amp.gain, t, 0.45, vel));
    },

    /** A snare in a room a great deal bigger than it: most of it is the
     *  send. */
    snare(out, t, _dur, _freqs, vel) {
      const note = voice(t);
      const src = note.noise();
      const band = note.filter('bandpass', 1900, 0.8);
      const thin = note.filter('highpass', 500);
      const amp = note.gain();
      src.connect(band).connect(thin).connect(amp).connect(out);
      const body = note.osc('triangle', 200);
      body.frequency.exponentialRampToValueAtTime(155, t + 0.08);
      const bodyAmp = note.gain();
      body.connect(bodyAmp).connect(out);
      hit(bodyAmp.gain, t, 0.09, 0.4 * vel);
      note.play(hit(amp.gain, t, 0.22, 0.7 * vel));
    },

    hat(out, t, _dur, _freqs, vel) {
      const note = voice(t);
      const src = note.noise();
      const air = note.filter('highpass', 8200);
      const amp = note.gain();
      src.connect(air).connect(amp).connect(out);
      note.play(hit(amp.gain, t, 0.03, 0.5 * vel));
    },

    pulse(out, t, dur, [freq], vel) {
      const note = voice(t);
      const low = note.filter('lowpass', 300, 5);
      low.frequency.linearRampToValueAtTime(1300 * vel, t + 0.006);
      low.frequency.setTargetAtTime(280, t + 0.006, 0.04);
      note.osc('sawtooth', freq).connect(low);
      note.osc('square', freq / 2).connect(low);
      const amp = note.gain();
      low.connect(amp).connect(out);
      note.play(shape(amp.gain, t, dur * 0.8, {
        peak: 0.5 * vel, attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.03,
      }));
    },

    /** Saws that open slowly, and a vibrato that turns up once the chord has
     *  been held long enough to be sure of itself. */
    brass(out, t, dur, freqs, vel) {
      const note = voice(t);
      const low = note.filter('lowpass', 350, 1.5);
      low.frequency.setTargetAtTime(2100, t, 0.35);
      low.frequency.setTargetAtTime(1300, t + 1.2, 0.8);
      for (const freq of freqs) {
        for (const cents of [-9, 9]) {
          const osc = note.osc('sawtooth', freq, cents);
          note.wobble(osc.detune, 4.8, 8, 0.9);
          osc.connect(low);
        }
      }
      const amp = note.gain();
      low.connect(amp).connect(out);
      note.play(shape(amp.gain, t, dur, {
        peak: (0.3 * vel) / freqs.length, attack: 0.35, decay: 1, sustain: 0.85, release: 1.3,
      }));
    },

    arp(out, t, _dur, [freq], vel) {
      const note = voice(t);
      const low = note.filter('lowpass', 3200, 3);
      low.frequency.setTargetAtTime(500, t, 0.05);
      note.osc('sawtooth', freq).connect(low);
      const amp = note.gain();
      low.connect(amp).connect(out);
      note.play(hit(amp.gain, t, 0.2, 0.3 * vel));
    },

    lead(out, t, dur, [freq], vel) {
      const note = voice(t);
      const low = note.filter('lowpass', 2400, 3);
      const from = lastLead && Math.abs(Math.log2(lastLead / freq)) < 1 ? lastLead : freq;
      lastLead = freq;
      for (const [type, cents] of [['square', -6], ['sawtooth', 6]]) {
        const osc = note.osc(type, from, cents);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
        note.wobble(osc.detune, 5.2, 16, 0.3);
        osc.connect(low);
      }
      const amp = note.gain();
      low.connect(amp).connect(out);
      note.play(shape(amp.gain, t, dur, {
        peak: 0.26 * vel, attack: 0.03, decay: 0.4, sustain: 0.75, release: 0.25,
      }));
    },

    /** A camera finding you. */
    ping(out, t, _dur, [freq], vel) {
      const note = voice(t);
      const src = note.osc('sine', freq);
      const over = note.osc('sine', freq * 2.01);
      const overAmp = note.gain(0.2);
      over.connect(overAmp);
      const amp = note.gain();
      src.connect(amp);
      overAmp.connect(amp);
      amp.connect(out);
      note.play(hit(amp.gain, t, 0.6, 0.4 * vel, 0.004));
    },

    rain(out, t, dur, _freqs, vel) {
      const note = voice(t);
      const src = note.noise();
      const thin = note.filter('highpass', 900);
      const soft = note.filter('lowpass', 6500);
      const amp = note.gain();
      src.connect(thin).connect(soft).connect(amp).connect(out);
      note.play(shape(amp.gain, t, dur, {
        peak: 0.12 * vel, attack: 0.6, decay: 1, sustain: 1, release: 0.9,
      }));
    },

    keys(out, t, dur, freqs, vel) {
      for (const freq of freqs) {
        fm(out, t, freq, {
          ratio: 1, index: 1.6, fall: 0.5, peak: (0.28 * vel) / freqs.length,
          ring: Math.max(dur, 0.8), sustain: 0.25, warble: 9,
        });
      }
    },

    vibes(out, t, dur, [freq], vel) {
      fm(out, t, freq, {
        ratio: 4, index: 0.9, fall: 0.25, peak: 0.16 * vel,
        ring: Math.max(dur, 1.2), sustain: 0.1, warble: 6, tremolo: 0.35,
      });
    },

    /** Something round and polite underneath. */
    upright(out, t, dur, [freq], vel) {
      const note = voice(t);
      const low = note.filter('lowpass', 480);
      note.osc('sine', freq).connect(low);
      note.osc('triangle', freq).connect(low);
      const amp = note.gain();
      low.connect(amp).connect(out);
      note.play(shape(amp.gain, t, dur, {
        peak: 0.5 * vel, attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.12,
      }));
    },

    /** Attention, please. */
    chime(out, t, dur, [freq], vel) {
      fm(out, t, freq, { ratio: 3.5, index: 1.1, fall: 0.5, peak: 0.25 * vel, ring: Math.max(dur, 1.8) });
    },
  };
}

export const SOUNDTRACK = {
  volume: 0.22,
  space: {
    reverb: { seconds: 3.4, decay: 2.6, level: 1 },
    echo: { beats: 0.75, feedback: 0.45, tone: 2200 },
  },
  instruments,

  /** The longer the shift, the more of it there is. */
  level(snapshot) {
    if (snapshot.state !== 'running') return 0;
    const grind = snapshot.distance;
    return grind < 100 ? 0 : grind < 300 ? 1 : grind < 600 ? 2 : 3;
  },

  cues: {
    title: {
      bpm: 92,
      parts: [
        { play: 'keys', gain: 1.95, wet: 0.35, notes: twice(({ keys }) => `${hold(keys, 6)} ${hold(keys, 10)}`) },
        { play: 'vibes', gain: 2.1, wet: 0.4, echo: 0.2, pan: 0.2, notes: VIBES },
        {
          play: 'upright', gain: 0.21,
          notes: twice(({ root, fifth }) => `${hold(root, 6)} ${hold(fifth, 2)} ${hold(root, 6)} ${hold(fifth, 2)}`),
        },
        { play: 'rain', gain: 0.8, pan: -0.1, notes: RAIN },
      ],
    },

    run: {
      bpm: 112,
      parts: [
        { play: 'rain', gain: 0.7, notes: RAIN },
        { play: 'kick', gain: 0.5, notes: 'x . . . x . . . x . . . x . . .' },
        { play: 'pulse', gain: 0.48, notes: each(pulse) },
        { play: 'snare', gain: 1.5, at: 1, wet: 0.7, notes: '. . . . X . . . . . . . X . . .' },
        { play: 'hat', gain: 1.6, at: 1, pan: 0.25, notes: 'o o x o o o x o o o x o o o x o' },
        { play: 'ping', gain: 1.25, at: 1, wet: 0.5, echo: 0.6, pan: -0.4, notes: `c6 ${rest(31)}` },
        { play: 'brass', gain: 1.15, at: 2, wet: 0.55, notes: across(({ brass }) => hold(brass, 32)) },
        { play: 'arp', gain: 1.1, at: 2, echo: 0.45, pan: 0.3, notes: each(climb) },
        { play: 'lead', gain: 0.5, at: 3, wet: 0.4, echo: 0.35, notes: LEAD },
      ],
    },

    /** Your shift has ended. */
    over: {
      bpm: 92,
      once: true,
      then: 'title',
      parts: [
        { play: 'chime', gain: 1, wet: 0.6, notes: `e5 - - - c5 - - - g4 - - - - - - - ${rest(16)}` },
        { play: 'rain', gain: 0.8, notes: RAIN },
      ],
    },
  },
};
