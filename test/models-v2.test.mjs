import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
// Binary STL: watertight (every edge shared by exactly 2 faces), single shell, positive volume.
function stl(n) {
  const b = fs.readFileSync(new URL(`../assets/print/${n}.stl`, import.meta.url)); const t = b.readUInt32LE(80);
  const key = new Map(), edges = new Map(), par = []; let vol = 0;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const vid = (x, y, z) => { const k = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3); if (!key.has(k)) { key.set(k, key.size); par.push(par.length); } return key.get(k); };
  for (let i = 0; i < t; i++) {
    const o = 84 + i * 50 + 12, v = [];
    for (let k = 0; k < 3; k++) v.push([b.readFloatLE(o + k * 12), b.readFloatLE(o + k * 12 + 4), b.readFloatLE(o + k * 12 + 8)]);
    vol += (v[0][0] * (v[1][1] * v[2][2] - v[1][2] * v[2][1]) - v[0][1] * (v[1][0] * v[2][2] - v[1][2] * v[2][0]) + v[0][2] * (v[1][0] * v[2][1] - v[1][1] * v[2][0])) / 6;
    const id = v.map(p => vid(...p));
    for (let k = 0; k < 3; k++) { const a = id[k], c = id[(k + 1) % 3], e = a < c ? a + '_' + c : c + '_' + a; edges.set(e, (edges.get(e) || 0) + 1); par[find(a)] = find(c); }
  }
  const roots = new Set(); for (let i = 0; i < par.length; i++) roots.add(find(i));
  return { bad: [...edges.values()].filter(c => c !== 2).length, shells: roots.size, vol };
}
for (const n of ['colby', 'mouse', 'rat', 'commander', 'deathrat']) {
  test('stl watertight single shell ' + n, () => { const r = stl(n); assert.equal(r.bad, 0, "non-manifold edges " + r.bad); assert.equal(r.shells, 1); assert.ok(r.vol > 0, 'vol ' + r.vol); });
}
test('colby/mouse nodes', () => {
  const g = n => { const b = fs.readFileSync(new URL(`../assets/models/${n}.glb`, import.meta.url)); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString()); };
  const c = g('colby'); for (const k of ['Flame', 'Body', 'Head']) assert.ok(c.nodes.some(x => x.name === k), k);
  const m = g('mouse'); for (const k of ['Tail', 'Body', 'Head']) assert.ok(m.nodes.some(x => x.name === k), k);
});
