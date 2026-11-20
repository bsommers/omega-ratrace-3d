import { test } from 'node:test'; import assert from 'node:assert'; import fs from 'node:fs';
const load = n => { const b = fs.readFileSync(new URL(`../assets/models/${n}.glb`, import.meta.url)); const l = b.readUInt32LE(12); return { b, j: JSON.parse(b.slice(20, 20 + l).toString()) }; };
const ext = j => { const v = j.accessors.filter(a => a.type === 'VEC3' && a.min); return [0, 1, 2].map(i => [Math.min(...v.map(a => a.min[i])), Math.max(...v.map(a => a.max[i]))]); };
const tris = j => j.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + (p.indices !== undefined ? j.accessors[p.indices].count : 0) / 3, 0), 0);
test('arena glb 16x9 m, floor top y=0, neon emissive', () => {
  const { b, j } = load('arena'); assert.equal(b.toString('ascii', 0, 4), 'glTF');
  const [x, y, z] = ext(j);
  assert.ok(Math.abs(x[1] - x[0] - 16.6) < 0.05 && Math.abs(z[1] - z[0] - 9.6) < 0.05, 'xz');
  assert.ok(Math.abs(x[0] + x[1]) < 1e-3 && Math.abs(z[0] + z[1]) < 1e-3, 'centred');
  assert.ok(y[0] <= -0.19 && y[1] >= 0.49 && y[1] <= 0.51);
  assert.ok(j.nodes.some(n => n.name === 'ArenaFloor'));
  assert.ok(j.materials.some(m => m.emissiveTexture && m.normalTexture));
  assert.ok(tris(j) <= 40000);
});
test('mousehole glb 8.4x3.8 m', () => {
  const { j } = load('mousehole'); const [x, y, z] = ext(j);
  assert.ok(Math.abs(x[1] - x[0] - 8.4) < 0.01 && Math.abs(z[1] - z[0] - 3.8) < 0.01);
  const bk = j.accessors.find(a => a.type === 'VEC3' && a.min && a.max[1] > 0.85); assert.ok(bk && Math.abs(bk.min[1]) < 1e-3 && Math.abs(bk.max[1] - 0.9) < 1e-3);
  assert.ok(j.nodes.some(n => n.name === 'MouseHoleBlock')); assert.ok(tris(j) <= 40000);
});
test('textures <=1024 and stl present', () => {
  const d = new URL('../assets/textures/', import.meta.url);
  const pngs = fs.readdirSync(d).filter(f => /^(arena|mousehole)_.*\.png$/.test(f)); assert.ok(pngs.length >= 9);
  for (const f of pngs) { const b = fs.readFileSync(new URL(f, d)); assert.ok(b.readUInt32BE(16) <= 1024 && b.readUInt32BE(20) <= 1024, f); }
  for (const n of ['arena', 'mousehole']) assert.ok(fs.statSync(new URL(`../assets/print/${n}.stl`, import.meta.url)).size > 1e5);
});
