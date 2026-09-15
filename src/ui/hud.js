const PIP = '▮';

const LEAD = {
  ready: 'Run east. Bank credits. Terms subject to change without notice.',
  over: 'Position liquidated. Your replacement starts in the morning.',
};

function stat(label, value) {
  return `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;
}

function metres(value) {
  return `${Math.max(0, Math.floor(value))}m`;
}

/**
 * The readouts, and the panel that covers them between runs. Markup lives in
 * index.html; this only ever writes text and flips `hidden`.
 */
export function createHud(doc = document, lives = 3) {
  const $ = (id) => doc.getElementById(id);

  const score = $('score');
  const grind = $('grind');
  const credits = $('credits');
  const shells = $('shells');
  const overlay = $('overlay');
  const kicker = $('overlay-kicker');
  const lead = $('overlay-lead');
  const stats = $('overlay-stats');
  const play = $('play');

  function pips(left) {
    return PIP.repeat(Math.max(0, left)) + `<span class="spent">${PIP.repeat(Math.max(0, lives - left))}</span>`;
  }

  /** The readouts are written sixty times a second and change a handful of
   *  times a run, so each one only touches the DOM when its text moves. */
  const shown = {};
  function put(node, key, value, html = false) {
    if (shown[key] === value) return;
    shown[key] = value;
    if (html) node.innerHTML = value;
    else node.textContent = value;
  }

  return {
    update(snapshot) {
      put(score, 'score', String(snapshot.score));
      put(grind, 'grind', metres(snapshot.distance));
      put(credits, 'credits', String(snapshot.credits));
      put(shells, 'shells', pips(snapshot.lives), true);
    },

    ready(best) {
      overlay.hidden = false;
      overlay.dataset.state = 'ready';
      kicker.textContent = 'onboarding complete…';
      lead.textContent = LEAD.ready;
      stats.hidden = best <= 0;
      stats.innerHTML = best > 0 ? stat('best', best) : '';
      play.textContent = 'clock in';
    },

    over(snapshot, best) {
      overlay.hidden = false;
      overlay.dataset.state = 'over';
      kicker.textContent = 'account terminated';
      lead.textContent = LEAD.over;
      stats.hidden = false;
      stats.innerHTML = [
        ['score', snapshot.score],
        ['grind', metres(snapshot.distance)],
        ['credits', snapshot.credits],
        /** Cams only earn a column on a run that took one out. */
        ...(snapshot.cams > 0 ? [['cams', snapshot.cams]] : []),
        ['best', best],
      ].map(([label, value]) => stat(label, value)).join('');
      play.textContent = 'next shift';
    },

    running() {
      overlay.hidden = true;
      overlay.dataset.state = 'running';
    },

    onPlay(fn) {
      play.addEventListener('click', (event) => {
        event.stopPropagation();
        fn();
      });
    },
  };
}
