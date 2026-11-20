import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/core/input.js';
import { pad } from '../src/ui/font.js';

function fakeTarget() { const h = {}; return { addEventListener: (e, f) => (h[e] ||= []).push(f), removeEventListener() {}, fire: (e, ev) => (h[e] || []).forEach(f => f(ev)) }; }
test('keyboard maps to input', () => {
  const t = fakeTarget(); const inp = createInput(t);
  const k = code => ({ code, repeat: false, preventDefault() {}, target: {} });
  t.fire('keydown', k('ArrowLeft')); t.fire('keydown', k('KeyW')); t.fire('keydown', k('Space'));
  let s = inp.poll(); assert.equal(s.rot, -1); assert.equal(s.thrust, 1); assert.equal(s.fire, true); assert.equal(s.bomb, false);
  t.fire('keydown', k('KeyX')); assert.equal(inp.poll().bomb, true); assert.equal(inp.poll().bomb, false);
  t.fire('keyup', k('ArrowLeft')); t.fire('keydown', k('KeyD')); assert.equal(inp.poll().rot, 1);
});
test('pause edge + action callback', () => {
  const t = fakeTarget(); const inp = createInput(t); const got = []; inp.onAction(a => got.push(a));
  t.fire('keydown', { code: 'KeyP', repeat: false, preventDefault() {}, target: {} }); t.fire('keydown', { code: 'KeyM', repeat: false, preventDefault() {}, target: {} });
  assert.deepEqual(got, ['pause', 'mute']);
});
test('pad', () => assert.equal(pad(42), '000042'));
