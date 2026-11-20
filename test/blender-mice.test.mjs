import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const WS = 0.02;
const R = { mouse: 10, rat: 12, commander: 15, mine: 9, deathrat: 18, tuna: 9, hairball: 3 };
const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function trs(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2*(y*y + z*z)) * sx, 2*(x*y + z*w) * sx, 2*(x*z - y*w) * sx, 0,
          2*(x*y - z*w) * sy, (1 - 2*(x*x + z*z)) * sy, 2*(y*z + x*w) * sy, 0,
          2*(x*z + y*w) * sz, 2*(y*z - x*w) * sz, (1 - 2*(x*x + y*y)) * sz, 0, tx, ty, tz, 1];
}
function glb(n) {
  const b = fs.readFileSync(new URL(`../assets/models/${n}.glb`, import.meta.url));
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20 + len).toString());
}
for (const n of ['mouse', 'rat', 'commander', 'deathrat', 'mine', 'tuna', 'yarn', 'hairball']) {
  test(n, () => {
    const j = glb(n);
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], tris = 0;
    const walk = (i, M) => {
      const nd = j.nodes[i];
      const m = mul(M, trs(nd));
      if (nd.mesh !== undefined) for (const p of j.meshes[nd.mesh].primitives) {
        const a = j.accessors[p.attributes.POSITION];
        tris += j.accessors[p.indices].count / 3;
        for (let c = 0; c < 8; c++) {
          const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
          const w = [0, 1, 2].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
        }
      }
      (nd.children || []).forEach(c => walk(c, m));
    };
    j.scenes[0].nodes.forEach(i => walk(i, I));
    assert.ok(tris <= 40000, 'tris ' + tris);
    assert.ok(lo[1] >= -1e-3, 'y>=0');
    if (R[n]) {
      const rad = R[n] * WS;
      assert.ok(hi[0] - lo[0] >= rad && hi[0] - lo[0] <= rad * 4.2, 'x extent ' + (hi[0] - lo[0]));
      if (['mouse', 'rat', 'commander', 'deathrat'].includes(n)) { assert.ok(hi[0] >= 0.4 * rad && hi[0] <= 0.7 * rad, 'nose +X within body half-length ' + hi[0]); assert.ok(-lo[0] > hi[0], 'tail -X'); assert.ok(j.nodes.some(x => x.name === 'Tail'), 'Tail node'); }
      else assert.ok(hi[0] >= rad && -lo[0] > hi[0] / 2, 'nose +X, tail -X');
    }
    assert.ok(fs.statSync(new URL(`../assets/print/${n}.stl`, import.meta.url)).size > 1000);
    if (n === 'mine') assert.ok(j.nodes.some(x => x.name === 'Armed'));
  });
}
