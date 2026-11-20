import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, setBehaviors } from '../src/sim/game.js';
import { BEHAVIORS } from '../src/sim/enemies.js';
import { createBus } from '../src/core/events.js';

test('main wires setBehaviors(BEHAVIORS)', () => {
  const s = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(s, /setBehaviors\(BEHAVIORS\)/);
});
test('renderer forwards quality/viewport to fx, lighting, post', () => {
  const s = fs.readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  for (const k of ['fx?.setViewportHeight', 'fx?.setQuality', 'lighting?.setQuality', 'post?.setQuality', 'post?.resize']) assert.ok(s.includes(k), k);
});
test('vertical mice drift sideways (no stuck lane)', () => {
  const e = { id: 2, vx: 0, vy: 90 };
  for (let i = 0; i < 120; i++) BEHAVIORS.mouse.update(e, 1 / 60);
  assert.ok(Math.abs(e.vx) > 10); assert.ok(Math.abs(Math.hypot(e.vx, e.vy) - 90) < 1);
});
test('game runs 10 s with real behaviours', () => {
  setBehaviors(BEHAVIORS); const g = createGame({ seed: 1, bus: createBus() });
  for (let i = 0; i < 600; i++) g.update(1 / 60, { rot: 0, thrust: 0, fire: false, bomb: false });
  assert.ok(g.ents.length > 0);
});
