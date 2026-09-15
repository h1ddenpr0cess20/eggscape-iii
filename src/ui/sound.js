const VOICES = {
  jump: { from: 300, to: 760, time: 0.11, type: 'square', gain: 0.05 },
  land: { from: 170, to: 78, time: 0.09, type: 'square', gain: 0.045 },
  /** The sound of being paid, which is a notification and nothing more. */
  credit: { from: 980, to: 1640, time: 0.08, type: 'square', gain: 0.05 },
  smash: { from: 520, to: 70, time: 0.25, type: 'sawtooth', gain: 0.08 },
  hit: { from: 240, to: 52, time: 0.32, type: 'sawtooth', gain: 0.1 },
  over: { from: 260, to: 34, time: 1, type: 'sawtooth', gain: 0.1 },
  start: { from: 140, to: 620, time: 0.34, type: 'square', gain: 0.055 },
};

/** A handful of oscillators' worth of somewhere you are not allowed to be,
 *  built on the first gesture because no browser will start an AudioContext
 *  before one. */
export function createSound() {
  let ctx = null;
  let muted = false;

  function context() {
    if (ctx) return ctx;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  }

  return {
    get muted() { return muted; },
    set muted(value) { muted = Boolean(value); },

    play(name) {
      const voice = VOICES[name];
      if (!voice || muted) return;
      const audio = context();
      if (!audio) return;
      if (audio.state === 'suspended') audio.resume();

      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(voice.from, now);
      osc.frequency.exponentialRampToValueAtTime(voice.to, now + voice.time);
      gain.gain.setValueAtTime(voice.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.time);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + voice.time + 0.02);
    },
  };
}
