#!/usr/bin/env node
// Asset validator: GLB structural check (Node) + STL check (Blender headless). Writes assets/manifest.json and the table in docs/ASSETS.md.
// Usage: node tools/validate-assets.mjs [--no-blender] [--no-write] [--optional=mousehole,arena] [--tri-budget=40000]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d;
const BUDGET = +opt('tri-budget', 40000);
const OPTIONAL = new Set(opt('optional', '').split(',').filter(Boolean));
const CT = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

async function getModels() {
  try { return [...(await import(path.join(ROOT, 'src/core/defs.js'))).MODELS]; }
  catch { return ['colby', 'mouse', 'rat', 'commander', 'deathrat', 'mine', 'tuna', 'yarn', 'hairball', 'mousehole', 'arena']; }
}

export function checkGlb(file) {
  const r = { ok: false, errors: [] };
  const buf = fs.readFileSync(file);
  r.bytes = buf.length;
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) { r.errors.push('bad magic'); return r; }
  if (buf.readUInt32LE(4) !== 2) r.errors.push('version!=2');
  if (buf.readUInt32LE(8) !== buf.length) r.errors.push('length header mismatch');
  const jl = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) { r.errors.push('first chunk not JSON'); return r; }
  let j;
  try { j = JSON.parse(buf.slice(20, 20 + jl).toString('utf8')); } catch (e) { r.errors.push('JSON parse: ' + e.message); return r; }
  let bin = 0, o = 20 + jl;
  if (o + 8 <= buf.length && buf.readUInt32LE(o + 4) === 0x004e4942) bin = buf.readUInt32LE(o);
  const bvs = j.bufferViews || [], acc = j.accessors || [];
  const buf0 = (j.buffers || [])[0];
  if (buf0 && buf0.byteLength > bin) r.errors.push('buffer byteLength > BIN chunk');
  bvs.forEach((b, i) => { if ((b.byteOffset || 0) + b.byteLength > bin) r.errors.push(`bufferView ${i} out of bounds`); });
  acc.forEach((a, i) => {
    const bv = bvs[a.bufferView];
    if (a.bufferView === undefined) return;
    if (!bv) { r.errors.push(`accessor ${i} bad bufferView`); return; }
    const sz = CT[a.componentType] * NC[a.type];
    const stride = bv.byteStride || sz;
    const need = (a.byteOffset || 0) + stride * (a.count - 1) + sz;
    if (a.count > 0 && need > bv.byteLength) r.errors.push(`accessor ${i} exceeds bufferView`);
  });
  let tris = 0, prims = 0;
  for (const m of j.meshes || []) for (const p of m.primitives || []) {
    prims++;
    const mode = p.mode ?? 4;
    if (p.attributes?.POSITION === undefined) { r.errors.push('primitive without POSITION'); continue; }
    const n = p.indices !== undefined ? acc[p.indices]?.count : acc[p.attributes.POSITION]?.count;
    if (n === undefined) { r.errors.push('primitive accessor missing'); continue; }
    if (mode === 4) tris += Math.floor(n / 3); else if (mode === 5 || mode === 6) tris += Math.max(0, n - 2);
    for (const k of Object.values(p.attributes)) if (!acc[k]) r.errors.push('attribute accessor missing');
    if (p.indices !== undefined && acc[p.indices]) {
      const pc = acc[p.attributes.POSITION].count;
      // index range check via min/max if present
      const mx = acc[p.indices].max?.[0];
      if (mx !== undefined && mx >= pc) r.errors.push('index max >= vertex count');
    }
  }
  const named = (j.nodes || []).filter(n => n.name).length;
  r.tris = tris; r.meshes = (j.meshes || []).length; r.primitives = prims; r.materials = (j.materials || []).length;
  r.images = (j.images || []).length; r.nodes = (j.nodes || []).length; r.namedNodes = named;
  if (!prims) r.errors.push('no mesh primitives');
  if (tris > BUDGET) r.errors.push(`tris ${tris} > budget ${BUDGET}`);
  if (!named) r.errors.push('no named nodes');
  // world-space bbox from POSITION min/max (ignoring node transforms except translation/scale)
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const m of j.meshes || []) for (const p of m.primitives || []) {
    const a = acc[p.attributes?.POSITION]; if (!a?.min || !a?.max) continue;
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a.min[k]); mx[k] = Math.max(mx[k], a.max[k]); }
  }
  if (mn[0] < 1e8) r.meshBboxM = mn.map((v, k) => +(mx[k] - v).toFixed(3));
  r.ok = r.errors.length === 0;
  return r;
}

const models = await getModels();
const out = { generated: new Date().toISOString(), triBudget: BUDGET, models: {}, errors: [] };
const glbDir = path.join(ROOT, 'assets/models'), printDir = path.join(ROOT, 'assets/print');

for (const name of models) {
  const f = path.join(glbDir, name + '.glb');
  const e = out.models[name] = { glb: null, stl: null };
  if (!fs.existsSync(f)) {
    if (OPTIONAL.has(name)) e.glb = { ok: true, skipped: 'missing (optional)' };
    else { e.glb = { ok: false, errors: ['missing'] }; }
  } else { try { e.glb = checkGlb(f); } catch (x) { e.glb = { ok: false, errors: [String(x)] }; } }
}

if (!args.includes('--no-blender')) {
  const tmp = path.join(process.env.CLAUDE_CODE_TMPDIR || path.join(ROOT, 'out'), 'validate-stl.json');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  const bl = process.env.BLENDER || (fs.existsSync('/snap/bin/blender') ? '/snap/bin/blender' : 'blender');
  const p = spawnSync(bl, ['-b', '-P', path.join(ROOT, 'tools/blender/validate.py'), '--', printDir, tmp], { encoding: 'utf8' });
  if (p.status !== 0 || !fs.existsSync(tmp)) out.errors.push('blender run failed: ' + (p.error?.message || (p.stderr || '').slice(-200)));
  else {
    const stl = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    for (const [n, v] of Object.entries(stl)) (out.models[n] ||= { glb: null }).stl = v;
  }
  for (const [n, e] of Object.entries(out.models)) if (!e.stl && !out.errors.length && !OPTIONAL.has(n) && fs.existsSync(path.join(printDir, n + '.stl')) === false && ['mousehole', 'arena'].includes(n) === false) e.stl = { ok: false, errors: ['missing stl'] };
}

for (const [n, e] of Object.entries(out.models)) {
  for (const k of ['glb', 'stl']) if (e[k] && !e[k].ok) out.errors.push(`${n}.${k}: ${e[k].errors.join('; ')}`);
}
out.ok = out.errors.length === 0;

if (!args.includes('--no-write')) {
  fs.writeFileSync(path.join(ROOT, 'assets/manifest.json'), JSON.stringify(out, null, 1) + '\n');
  const rows = Object.entries(out.models).map(([n, e]) => {
    const g = e.glb || {}, s = e.stl || {};
    const st = x => (!x || x.skipped) ? '-' : x.ok ? 'ok' : 'FAIL';
    return `| ${n} | ${st(g)} | ${g.tris ?? '-'} | ${g.bytes ? (g.bytes / 1024).toFixed(0) : '-'} | ${st(s)} | ${s.shells ?? '-'} | ${s.volumeMm3 ? (s.volumeMm3 / 1000).toFixed(1) : '-'} | ${s.bboxMm ? s.bboxMm.join('x') : '-'} | ${s.minWallMm ?? '-'} |`;
  });
  const table = ['<!-- asset-table:start -->', '| model | glb | tris | glb KiB | stl | shells | vol cm3 | bbox mm | min wall mm |', '|---|---|---|---|---|---|---|---|---|', ...rows, '<!-- asset-table:end -->'].join('\n');
  const dp = path.join(ROOT, 'docs/ASSETS.md');
  let doc = fs.existsSync(dp) ? fs.readFileSync(dp, 'utf8') : '# Assets\n\nGenerated by `node tools/validate-assets.mjs` (table below is overwritten; edit outside the markers).\n\n';
  doc = /<!-- asset-table:start -->[\s\S]*<!-- asset-table:end -->/.test(doc) ? doc.replace(/<!-- asset-table:start -->[\s\S]*<!-- asset-table:end -->/, () => table) : doc.trimEnd() + '\n\n' + table + '\n';
  fs.writeFileSync(dp, doc);
}

for (const e of out.errors) console.error('FAIL', e);
console.log(out.ok ? `assets OK (${Object.keys(out.models).length} models)` : `assets FAILED (${out.errors.length} errors)`);
process.exit(out.ok ? 0 : 1);
