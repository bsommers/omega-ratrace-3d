import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/sim/game.js';
import { DIFFICULTY, TICK } from '../src/core/defs.js';

const mk = (difficulty, seed = 1) => { const g = createGame({ seed, difficulty }); g.state = 'play'; g.ship.invuln = 0; return g; };
const touch = (g, kind = 'mouse') => { const s = g.ship; g.spawn(kind, { x: s.x, y: s.y }); g.update(TICK, {}); };
const wait = (g, sec) => { for (let i = 0; i < Math.ceil(sec / TICK); i++) g.update(TICK, {}); };

test('hull per level + default normal', () => {
  for (const [k, v] of Object.entries({ hard: 4, normal: 6, easy: 8, kitten: 13, classic: 1 })) {
    const g = createGame({ difficulty: k }); assert.equal(g.ship.hull, v); assert.equal(g.ship.hullMax, v); assert.equal(DIFFICULTY[k].hull, v);
  }
  assert.equal(createGame().ship.hullMax, 6);
  assert.equal(createGame({ difficulty: 'bogus' }).ship.hullMax, 6);
});

test('hit removes 1 hull and grants ~1s invulnerability', () => {
  const g = mk('normal'); const ev = [];
  g.bus.on('sfx', p => ev.push(p.name));
  touch(g);
  assert.equal(g.ship.hull, 5); assert.equal(g.lives, 3); assert.ok(g.ship.alive);
  assert.ok(g.ship.invuln > 0.9 && g.ship.invuln <= 1.0); assert.ok(ev.includes('hit'));
  touch(g); assert.equal(g.ship.hull, 5); // within invuln window
  wait(g, 1.05); touch(g); assert.equal(g.ship.hull, 4);
});

test('life lost only at 0 hull; refill on respawn', () => {
  const g = mk('hard');
  for (let i = 0; i < 3; i++) { touch(g); wait(g, 1.05); }
  assert.equal(g.ship.hull, 1); assert.equal(g.lives, 3); assert.equal(g.state, 'play');
  touch(g); assert.equal(g.state, 'dying'); assert.equal(g.lives, 2); assert.equal(g.ship.hull, 0);
  wait(g, 1.6); assert.equal(g.state, 'play'); assert.equal(g.ship.hull, 4); assert.ok(g.ship.alive);
});

test('all levels take exactly hull hits to die', () => {
  for (const k of ['hard', 'normal', 'easy', 'kitten', 'classic']) {
    const g = mk(k), n = DIFFICULTY[k].hull;
    for (let i = 0; i < n - 1; i++) { touch(g); wait(g, 1.05); assert.notEqual(g.state, 'dying', k); }
    assert.equal(g.ship.hull, 1); touch(g); assert.equal(g.state, 'dying', k);
  }
});

test('deathrat removes 2 hull, leaves 1, kills at 1', () => {
  const g = mk('normal'); touch(g, 'deathrat'); assert.equal(g.ship.hull, 4);
  wait(g, 1.05); touch(g, 'deathrat'); assert.equal(g.ship.hull, 2);
  wait(g, 1.05); touch(g, 'deathrat'); assert.equal(g.ship.hull, 1); assert.equal(g.state, 'play');
  wait(g, 1.05); touch(g, 'deathrat'); assert.equal(g.state, 'dying');
  const h = mk('hard'); touch(h, 'deathrat'); assert.equal(h.ship.hull, 2); // 4 -> 2
});

test('ebullet counts as one hit', () => {
  const g = mk('easy'); touch(g, 'ebullet'); assert.equal(g.ship.hull, 7);
});

test('deterministic per difficulty', () => {
  for (const k of ['hard', 'normal', 'easy', 'kitten', 'classic']) {
    const run = () => { const g = createGame({ seed: 7, difficulty: k }); for (let i = 0; i < 2500; i++) g.update(TICK, { rot: Math.sin(i / 50), thrust: i % 90 < 60, fire: i % 7 < 3 }); return g.hash(); };
    assert.equal(run(), run(), k);
  }
});
