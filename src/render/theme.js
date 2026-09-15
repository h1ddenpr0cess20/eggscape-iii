/**
 * One city's worth of colour, at the hour it is always at. Almost everything
 * here is dark — the lit surfaces are cheap, the neon is not, and that ratio
 * is the whole look: a lot of grey with the money painted on top of it.
 */
export const THEME = {
  /** The dark, and the haze the far end of the walkway dissolves into. */
  night: 0x05070f,
  haze: 0x101a2e,
  glow: 0x233a63,

  /** Structure. Plate you stand on, frame that holds it, rail you cannot lean on. */
  deck: 0x333a48,
  grate: 0x1e2430,
  frame: 0x262d3a,
  steel: 0x3b4352,
  rail: 0x4c5666,
  hazard: 0xd8a33c,

  /** What the city spends on itself. */
  cyan: 0x2fe6ff,
  magenta: 0xff2f9e,
  acid: 0x9dff3d,
  amber: 0xffb23d,
  /** The colour of being seen. */
  alert: 0xff2d4a,

  /** Somebody else's lights, a long way down and a long way up. */
  window: 0xffcf85,
  street: 0xff8a3d,

  shadow: 0x000000,
};

/**
 * What the city pays in. Six denominations, none of which add up to leaving.
 * `course.js` picks which is where; this says what it is made of.
 */
export const DENOMINATION = [
  { name: 'chit', body: 0xffc24d, trim: 0x2fe6ff },
  { name: 'shard', body: 0x2fe6ff, trim: 0xe8fbff },
  { name: 'cell', body: 0x9dff3d, trim: 0x232a38 },
  { name: 'keycard', body: 0xff2f9e, trim: 0xe8f4ff },
  { name: 'die', body: 0xb8d4ff, trim: 0xffc24d },
  { name: 'tick', body: 0x4dffa0, trim: 0x0e3a25 },
];

export const CSS = {
  cyan: '#2fe6ff',
  magenta: '#ff2f9e',
  amber: '#ffb23d',
};
