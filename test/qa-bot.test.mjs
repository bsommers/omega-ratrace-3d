import test from 'node:test';
import assert from 'node:assert/strict';
import { playBot } from '../tools/botplay.mjs';
import { createAutopilot } from '../src/sim/autopilot.js';
import { createGame } from '../src/sim/game.js';

test('botplay is deterministic', () => {
  const a = playBot({ waves: 3, seed: 4 }), b = playBot({ waves: 3, seed: 4 });
  assert.equal(a.hash, b.hash); assert.equal(a.score, b.score);
});
test('different seeds diverge', () => {
  assert.notEqual(playBot({ waves: 2, seed: 1 }).hash, playBot({ waves: 2, seed: 2 }).hash);
});
test('bot is competent but waves 1-5 are not trivial (seeds 1-8)', () => {
  let reached = 0, deaths = 0;
  for (let s = 1; s <= 8; s++) { const r = playBot({ waves: 5, seed: s }); reached += r.waveReached; deaths += r.deaths; }
  assert.ok(reached / 8 >= 3, `avg wave reached ${reached / 8}`);
  assert.ok(deaths > 0, 'bot never dies: too easy');
});
test('autopilot returns valid input and never throws on empty game', () => {
  const g = createGame({ seed: 1 }); const i = createAutopilot().step(g);
  assert.ok(i.rot >= -1 && i.rot <= 1); assert.equal(typeof i.fire, 'boolean');
});
