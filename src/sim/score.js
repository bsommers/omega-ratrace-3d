// Score, combo, extra lives.
import { TUNING } from '../core/defs.js';

const COMBO_WINDOW = 3.0;

export function comboMult(n) { return Math.min(4, 1 + Math.floor(n / 5)); }

export function nextExtraLifeThreshold(g) {
  const T = TUNING;
  const i = g._extraIdx;
  if (i < T.extraLifeAt.length) return T.extraLifeAt[i];
  return T.extraLifeAt[T.extraLifeAt.length - 1] + (i - T.extraLifeAt.length + 1) * T.extraLifeEvery;
}

export function addScore(g, base, { combo = true, x, y } = {}) {
  let delta = base;
  if (combo && base > 0) {
    g.combo += 1; g.comboT = COMBO_WINDOW;
    delta = base * comboMult(g.combo);
    g.bus.emit('combo', { n: g.combo });
  }
  g.score += delta;
  if (g.score > g.hiscore) g.hiscore = g.score;
  g.bus.emit('score', { score: g.score, delta });
  if (x !== undefined) g.popup(delta > 0 ? '+' + delta : '' + delta, x, y);
  while (g.score >= nextExtraLifeThreshold(g)) {
    g._extraIdx++; g.lives++;
    g.bus.emit('life', { lives: g.lives });
    g.sfx('extralife');
    g.bus.emit('banner', { text: 'EXTRA LIFE', sub: '', dur: 1.5 });
  }
  return delta;
}

export function tickCombo(g, dt) {
  if (g.combo > 0) {
    g.comboT -= dt;
    if (g.comboT <= 0) resetCombo(g);
  }
}

export function resetCombo(g) {
  if (g.combo !== 0) { g.combo = 0; g.comboT = 0; g.bus.emit('combo', { n: 0 }); }
}
