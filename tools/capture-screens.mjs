#!/usr/bin/env node
// Capture release screenshots into docs/screenshots (1600x900), optimise, copy hero+4 to docs/site/img,
// copy Blender previews to docs/screenshots/models and build a contact sheet.
// node tools/capture-screens.mjs [--only name,name] [--gpu swiftshader|vulkan]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './serve.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const only = arg('only', '') ? arg('only').split(',') : null;
const gpu = arg('gpu', 'swiftshader');
const OUT = path.join(REPO_ROOT, 'docs/screenshots'), SITE = path.join(REPO_ROOT, 'docs/site/img');
fs.mkdirSync(path.join(OUT, 'models'), { recursive: true }); fs.mkdirSync(SITE, { recursive: true });

const G = 'window.__game', O = 'window.__omega';
const play = (extra = '') => `/index.html?autostart=1&bot=1&mute=1${extra}`;
const SHOTS = [
  { name: 'title', url: '/index.html?mute=1&quality=ultra&seed=7', wait: 3500 },
  { name: 'gameplay', url: play('&quality=ultra&seed=11&wave=6'), waitFor: `${G}.state==='play'&&${G}.ents.length>=8&&${G}.t>8&&${G}.ship.alive&&${G}.ship.invuln<=0`, wait: 100 },
  { name: 'deathrat', url: play('&quality=ultra&seed=5&wave=4'),
    waitFor: `${G}.state==='play'`, eval: `(${G}._waveT=1e4,1)`, then: `${G}.ents.some(e=>e.kind==='deathrat')`, wait: 2500 },
  { name: 'pause', url: play('&quality=ultra&seed=11&wave=6'), waitFor: `${G}.state==='play'&&${G}.ents.length>=10&&${G}.t>6`, eval: `(${O}.setPaused(true),1)`, wait: 800 },
  { name: 'gameover', url: play('&quality=ultra&seed=3&wave=5'), waitFor: `${G}.state==='play'&&${G}.t>4`,
    eval: `(${O}.screens.showGameOver(${G}.score||4200),1)`, wait: 1200 },
  { name: 'quality-low', url: play('&quality=low&seed=11&wave=6'), waitFor: `${G}.state==='play'&&${G}.t>8`, wait: 300 },
  { name: 'quality-ultra', url: play('&quality=ultra&seed=11&wave=6'), waitFor: `${G}.state==='play'&&${G}.t>8`, wait: 300 },
];

function shot(s) {
  const out = path.join(OUT, s.name + '.png');
  const a = ['tools/shot.mjs', '--url', s.url, '--out', out, '--size', '1600x900', '--gpu', gpu, '--timeout', '120000'];
  if (s.waitFor) a.push('--wait-for', s.waitFor);
  if (s.eval) a.push('--eval', s.eval);
  if (s.wait) a.push('--wait', String(s.wait));
  const r = spawnSync('node', a, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 240000 });
  const ok = r.status === 0 && fs.existsSync(out);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.name}${ok ? '' : ' ' + (r.stdout + r.stderr).split('\n').slice(-4).join(' | ')}`);
  return ok;
}
for (const s of SHOTS) if (!only || only.includes(s.name)) shot(s);

// optimise
for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.png'))) spawnSync('optipng', ['-quiet', '-o2', path.join(OUT, f)]);

// site copies: hero + 4
const pick = { 'hero.png': 'gameplay.png', 'shot-title.png': 'title.png', 'shot-deathrat.png': 'deathrat.png', 'shot-pause.png': 'pause.png', 'shot-gameover.png': 'gameover.png' };
for (const [d, s] of Object.entries(pick)) if (fs.existsSync(path.join(OUT, s))) fs.copyFileSync(path.join(OUT, s), path.join(SITE, d));

// model previews + contact sheet
const prev = path.join(REPO_ROOT, 'out/previews');
if (fs.existsSync(prev)) {
  const names = fs.readdirSync(prev).filter(f => f.endsWith('.png')).sort();
  for (const f of names) fs.copyFileSync(path.join(prev, f), path.join(OUT, 'models', f));
  if (names.length) {
    const args = [...names.map(f => path.join(OUT, 'models', f)), '-background', '#101018', '-fill', 'white', '-gravity', 'south'];
    const r = spawnSync('montage', [...names.map(f => path.join(OUT, 'models', f)), '-label', '%t', '-tile', '4x', '-geometry', '400x400+8+8', '-background', '#101018', '-fill', 'white', path.join(OUT, 'models/contact-sheet.png')], { encoding: 'utf8' });
    console.log(r.status === 0 ? `ok   contact sheet (${names.length})` : 'FAIL contact sheet ' + r.stderr.slice(0, 200));
    void args;
  }
}
