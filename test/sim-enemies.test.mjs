import { BEHAVIORS, segHitsBox } from '../src/sim/enemies.js';
import { createRng } from '../src/core/rng.js';
import { KINDS, BOX } from '../src/core/defs.js';
import assert from 'node:assert/strict';

function mock(seed = 1) {
  const g = { rng: createRng(seed), ents: [], ship: { x: 700, y: 60, alive: true }, log: [], t: 0 };
  g.spawn = (kind, p = {}) => { const K = KINDS[kind]; const e = { kind, x: 0, y: 0, vx: 0, vy: 0, angle: 0, r: K.r, hp: K.hp, t: 0, dead: false, ...p }; g.ents.push(e); BEHAVIORS[kind]?.init?.(e, g); return e; };
  g.kill = (e) => { if (e.dead) return; e.dead = true; BEHAVIORS[e.kind].onDeath?.(e, g); };
  g.sfx = (n) => g.log.push(n); g.fx = () => {};
  return g;
}
const run = (g, e, secs, dt = 1 / 60) => { for (let i = 0; i < secs / dt; i++) { e.t += dt; BEHAVIORS[e.kind].update(e, dt, g); e.x += e.vx * dt; e.y += e.vy * dt; } };

// mouse keeps speed
{ const g = mock(), e = g.spawn('mouse', { x: 50, y: 50, angle: 0.5 }); run(g, e, 1); assert.ok(Math.abs(Math.hypot(e.vx, e.vy) - 90) < 1); }
// rat homes (open line) and detours around box
{ const g = mock(); g.ship = { x: 100, y: 225, alive: true }; const e = g.spawn('rat', { x: 20, y: 225 }); run(g, e, 0.5); assert.ok(e.x > 20);
  assert.ok(segHitsBox(100, 225, 700, 225, 0));
  const e2 = g.spawn('rat', { x: 700, y: 225, vx: 0, vy: 140 }); g.ship = { x: 100, y: 225, alive: true };
  run(g, e2, 0.3); assert.ok(Math.abs(e2.vy) > 20, 'detours via corner'); }
// commander fires aimed bursts, drops tuna
{ const g = mock(); const e = g.spawn('commander', { x: 50, y: 50 }); run(g, e, 6);
  const bs = g.ents.filter((x) => x.kind === 'ebullet'); assert.ok(bs.length >= 3 && bs.length % 3 === 0);
  g.kill(e); assert.ok(g.ents.some((x) => x.kind === 'tuna')); }
// mine: 6 crumbs on death; self-arms and detonates near ship
{ const g = mock(); const e = g.spawn('mine', { x: 50, y: 50 }); g.kill(e); assert.equal(g.ents.filter((x) => x.kind === 'ebullet').length, 6);
  const g2 = mock(); g2.ship = { x: 60, y: 50, alive: true }; const m = g2.spawn('mine', { x: 50, y: 50, vx: 1, vy: 0 }); run(g2, m, 1); assert.ok(!m.dead); run(g2, m, 1); assert.ok(m.dead); }
// deathrat unkillable + hunts
{ const g = mock(); const e = g.spawn('deathrat', { x: 20, y: 20 }); e.hp = 0; run(g, e, 0.1); assert.ok(e.hp > 1e6); run(g, e, 2); assert.ok(Math.hypot(e.x - 20, e.y - 20) > 100); }
// tuna expires
{ const g = mock(); const e = g.spawn('tuna', { x: 5, y: 5 }); run(g, e, 7.5); assert.ok(!e.dead); run(g, e, 1); assert.ok(e.dead); }
// determinism
{ const a = mock(7), b = mock(7); const ea = a.spawn('commander', { x: 50, y: 50 }), eb = b.spawn('commander', { x: 50, y: 50 }); run(a, ea, 5); run(b, eb, 5); assert.deepEqual(a.ents.map((x) => [x.x, x.y]), b.ents.map((x) => [x.x, x.y])); }
console.log('sim-enemies: all tests passed');
