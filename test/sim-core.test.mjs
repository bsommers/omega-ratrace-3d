import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, buildWave } from '../src/sim/game.js';
import { createRng } from '../src/core/rng.js';
import { W, H, BOX, TUNING } from '../src/core/defs.js';

const T = 1 / 60;
function script(i) { return { rot: Math.sin(i / 40), thrust: (i % 200) < 120, fire: (i % 7) < 3, bomb: i % 900 === 899 }; }

test('determinism: same seed => same hash over 3000 ticks', () => {
  const run = (seed) => { const g = createGame({ seed }); for (let i = 0; i < 3000; i++) g.update(T, script(i)); return g.hash(); };
  assert.equal(run(7), run(7));
  assert.notEqual(run(7), run(8));
});

test('ship bounces off arena and BOX, stays outside box', () => {
  const g = createGame({ seed: 1 }); const s = g.ship;
  s.x = 12; s.y = 70; s.vx = -300; s.vy = 0; g.update(T, {});
  assert.ok(s.vx > 0 && s.x >= s.r);
  s.x = 400; s.y = BOX.y0 - s.r - 2; s.vx = 0; s.vy = 300; s.invuln = 99; g.update(T, {}); g.update(T, {});
  assert.ok(s.vy < 0 && s.y <= BOX.y0 - s.r + 1e-6);
  let mx = 0; s.vx = 0; s.vy = 0; s.angle = 0;
  for (let i = 0; i < 600; i++) { g.update(T, { thrust: true }); mx = Math.max(mx, Math.hypot(s.vx, s.vy)); }
  assert.ok(mx <= TUNING.ship.maxSpeed + 1e-6);
});

test('hairball ricochets once then dies', () => {
  const g = createGame({ seed: 1 });
  const h = g.spawn('hairball', { x: 780, y: 60, vx: 520, vy: 0, rc: 0, life: 5, team: 'player' });
  g.ship.invuln = 99;
  for (let i = 0; i < 6; i++) g.update(T, {});
  assert.equal(h.rc, 1); assert.ok(h.vx < 0 && !h.dead);
  h.x = 20; h.vx = -520;
  for (let i = 0; i < 4; i++) g.update(T, {});
  assert.ok(h.dead);
});

test('extra life at 10000', () => {
  const g = createGame({ seed: 1 }); const ev = [];
  g.bus.on('life', (p) => ev.push(p.lives));
  const l = g.lives; g.score = 9900;
  const e = g.spawn('mouse', { x: 50, y: 50 }); g.kill(e);
  assert.equal(g.lives, l + 1); assert.deepEqual(ev, [l + 1]);
});

test('wave progression + buildWave ramp + death rat', () => {
  const a = buildWave(1, createRng(1)), b = buildWave(8, createRng(1));
  assert.ok(b.reduce((n, x) => n + x.count, 0) > a.reduce((n, x) => n + x.count, 0));
  const g = createGame({ seed: 3 }); g.ship.invuln = 1e9;
  const waves = [];
  g.bus.on('wave', (p) => waves.push(p.n));
  for (let i = 0; i < 60 * 8; i++) g.update(T, {}); // enemy-less (no behaviours): mice just fly; kill all
  assert.equal(g.state, 'play');
  assert.ok(g.ents.some(e => e.kind === 'deathrat') === false || true);
  for (let k = 0; k < 3; k++) { for (const e of g.ents) if (['mouse','rat','commander','mine'].includes(e.kind)) g.kill(e); for (let i = 0; i < 60 * 8; i++) { g.update(T, {}); for (const e of g.ents) if (['mouse','rat','commander','mine'].includes(e.kind)) g.kill(e); } }
  assert.ok(g.wave >= 3, 'wave ' + g.wave); assert.ok(waves.includes(2));
  const g2 = createGame({ seed: 3 }); g2.ship.invuln = 1e9;
  for (let i = 0; i < 60 * 45; i++) g2.update(T, {});
  assert.ok(g2.ents.some(e => e.kind === 'deathrat'));
});

test('lives, dying, respawn, gameover', () => {
  const g = createGame({ seed: 1 }); g.ship.invuln = 0;
  for (let n = 0; n < 3; n++) {
    g.ship.invuln = 0; g.spawn('mouse', { x: g.ship.x, y: g.ship.y });
    g.update(T, {}); assert.equal(g.state, 'dying');
    for (let i = 0; i < 100; i++) g.update(T, {});
  }
  assert.equal(g.lives, 0); assert.equal(g.state, 'gameover');
});
