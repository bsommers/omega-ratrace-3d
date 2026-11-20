import { test } from 'node:test'; import assert from 'node:assert'; import fs from 'node:fs';
const glb = fs.readFileSync(new URL('../assets/models/colby.glb', import.meta.url));
const len = glb.readUInt32LE(12); const j = JSON.parse(glb.slice(20, 20 + len).toString());
test('colby glb', () => {
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.ok(j.nodes.some(n => n.name === 'Flame'));
  const mat = j.materials.find(m => m.name === 'FlameMat'); assert.ok(mat.emissiveFactor);
  let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += j.accessors[p.indices].count / 3;
  assert.ok(tris <= 40000, 'tris ' + tris);
  const xs = j.accessors.filter(a => a.type === 'VEC3' && a.min); const mn = Math.min(...xs.map(a => a.min[0])), mx = Math.max(...xs.map(a => a.max[0]));
  assert.ok(mx - mn > 0.4 && mx - mn < 0.5, 'len ' + (mx - mn));
});
test('colby stl', () => {
  const s = fs.readFileSync(new URL('../assets/print/colby.stl', import.meta.url)); assert.ok(s.length > 1000);
});
