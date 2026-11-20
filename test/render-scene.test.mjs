import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const hook = `export async function resolve(s,c,n){ if(s==='three') return {url:${JSON.stringify(pathToFileURL(root + '/vendor/three/build/three.module.js').href)},shortCircuit:true}; return n(s,c); }`;
register('data:text/javascript,' + encodeURIComponent(hook));

const THREE = await import('three');
const { createCamera } = await import('../src/render/camera.js');
const { buildArena } = await import('../src/render/arena.js');
const { createModelLibrary, makeFallback } = await import('../src/render/scene.js');
const { createEntities } = await import('../src/render/entities.js');
const { MODELS, W, H, WORLD_SCALE: S } = await import('../src/core/defs.js');

test('every model has a fallback with geometry', () => {
  for (const n of MODELS) { let m = 0; makeFallback(n).traverse(o => { if (o.isMesh) m++; }); assert.ok(m > 0, n); }
});
test('colby fallback has Flame node', () => {
  assert.ok(makeFallback('colby').getObjectByName('Flame'));
});
test('camera frames arena center, shake decays', () => {
  const c = createCamera(16 / 9); c.update(0.016, { ship: { x: W / 2, y: H / 2 } });
  assert.ok(c.camera.position.y > 5 && c.camera.position.z > 0);
  c.shake(10, 0.2); c.update(0.016, null); c.update(1, null); c.update(0.016, null);
  assert.equal(c.state.shakeMag, 0);
});
test('arena builds with floor, walls, mousehole', () => {
  const a = buildArena({});
  for (const n of ['floor', 'walls', 'mousehole']) assert.ok(a.getObjectByName(n), n);
});
test('entities pool by id, reuse meshes, map coords', () => {
  const models = createModelLibrary(); const parent = new THREE.Group(); const E = createEntities(parent, models);
  const g = { ship: { x: 400, y: 225, vx: 0, vy: 0, angle: 0, alive: true, invuln: 0, thrusting: true },
    ents: [{ id: 1, kind: 'mouse', x: 0, y: 0, vx: 0, vy: 0, angle: 0 }, { id: 2, kind: 'mine', x: 100, y: 100, vx: 0, vy: 0, angle: 0 }] };
  E.sync(g, 0, 1 / 60, 0);
  assert.equal(E.live.size, 3);
  const m1 = E.live.get(1).obj; assert.ok(Math.abs(m1.position.x + W * S / 2) < 1e-9);
  assert.ok(Math.abs(E.live.get('ship').obj.position.x) < 1e-9);
  g.ents[0].dead = true; E.sync(g, 0, 1 / 60, 0.1);
  assert.equal(E.live.size, 2); assert.equal(m1.visible, false);
  g.ents.push({ id: 9, kind: 'mouse', x: 5, y: 5, vx: 0, vy: 0, angle: 0 }); E.sync(g, 0, 1 / 60, 0.2);
  assert.equal(E.live.get(9).obj, m1); // reused
  const before = parent.children[0].children.length; for (let i = 0; i < 50; i++) E.sync(g, 0, 1 / 60, i);
  assert.equal(parent.children[0].children.length, before);
});
test('flame scales with thrust', () => {
  const models = createModelLibrary(); const E = createEntities(new THREE.Group(), models);
  const g = { ship: { x: 1, y: 1, vx: 0, vy: 0, angle: 0, alive: true, invuln: 0, thrusting: true }, ents: [] };
  for (let i = 0; i < 30; i++) E.sync(g, 0, 1 / 60, i / 60);
  const f = E.live.get('ship').flame; assert.ok(f.visible && f.scale.x > 0.5);
  g.ship.thrusting = false; for (let i = 0; i < 60; i++) E.sync(g, 0, 1 / 60, 1 + i / 60);
  assert.ok(!f.visible);
});
