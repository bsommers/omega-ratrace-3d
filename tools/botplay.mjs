#!/usr/bin/env node
// Headless deterministic autopilot run. Usage: node tools/botplay.mjs [--waves N] [--seed S] [--max-seconds T] [--json] [--lives L] [--difficulty hard|normal|easy|kitten|classic|all]
import { createGame, setBehaviors } from '../src/sim/game.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { TICK, TUNING } from '../src/core/defs.js';
let BEH = null;
try { BEH = (await import('../src/sim/enemies.js')).BEHAVIORS; } catch { /* enemies missing: run without behaviours */ }
if (BEH) setBehaviors(BEH);

export function playBot({ waves = 5, seed = 1, maxSeconds = 600, startWave = 1, difficulty = 'normal' } = {}) {
  const g = createGame({ seed, startWave, difficulty });
  const ap = createAutopilot();
  let deaths = 0, lastLives = g.lives, maxWave = g.wave, ticks = 0;
  const perWave = {};
  const lim = Math.round(maxSeconds / TICK);
  while (ticks < lim && g.state !== 'gameover' && !(g.wave > waves) ) {
    const prev = g.wave;
    g.update(TICK, ap.step(g)); ticks++;
    if (g.lives < lastLives) { deaths += lastLives - g.lives; lastLives = g.lives; perWave[g.wave] = (perWave[g.wave] || 0) + 1; }
    if (g.wave > maxWave) maxWave = g.wave;
    if (g.wave !== prev && !(prev in perWave)) perWave[prev] = perWave[prev] || 0;
  }
  const cleared = Math.min(waves, g.state === 'gameover' ? g.wave - 1 : g.wave > waves ? waves : g.wave - 1);
  return { seed, difficulty, hull: g.ship.hull, hullMax: g.ship.hullMax, wavesCleared: Math.max(0, cleared), waveReached: g.wave, deaths, score: g.score, lives: g.lives, state: g.state, seconds: +(g.t).toFixed(1), perWaveDeaths: perWave, hash: g.hash() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? +a[i + 1] : d; };
  const waves = arg('--waves', 5), seed = arg('--seed', 1), maxSeconds = arg('--max-seconds', 600);
  const di = a.indexOf('--difficulty'), dv = di >= 0 ? a[di + 1] : 'normal';
  const levels = dv === 'all' ? ['hard', 'normal', 'easy', 'kitten'] : [dv];
  for (const difficulty of levels) {
  const r = playBot({ waves, seed, maxSeconds, difficulty });
  const r2 = playBot({ waves, seed, maxSeconds, difficulty });
  r.deterministic = r.hash === r2.hash;
  const flags = [];
  if (!BEH) flags.push('no enemy behaviours loaded');
  if (!r.deterministic) flags.push('NONDETERMINISTIC');
  if (r.state === 'gameover' && r.waveReached <= Math.min(waves, 5)) flags.push(`bot died before wave ${waves} done (too hard or weak bot)`);
  if (r.wavesCleared >= waves && r.deaths === 0 && waves >= 3) flags.push('no deaths at all: possibly too easy');
  if (r.seconds >= maxSeconds) flags.push('timeout: waves not cleared (enemies unreachable / stalling?)');
  r.flags = flags;
  if (a.includes('--json')) console.log(JSON.stringify(r));
  else console.log(`${r.difficulty} seed=${r.seed} waves=${r.wavesCleared}/${waves} reached=${r.waveReached} deaths=${r.deaths} score=${r.score} state=${r.state} t=${r.seconds}s hash=${r.hash} det=${r.deterministic}${flags.length ? '\nFLAGS: ' + flags.join('; ') : ''}`);
  }
}
