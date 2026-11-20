#!/usr/bin/env node
// Web build: node tools/build-web.mjs [--out dir]
// Stages the playable game into dist/web/ (default): index.html, style.css, src/, vendor/three (build + examples/jsm),
// assets/{models,textures,manifest.json}. No bundler: the game uses an importmap + ES modules, all paths relative,
// so it works from any sub-path (e.g. /omega-ratrace-3d/play/).
import { cpSync, rmSync, mkdirSync, existsSync, statSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

export function buildWeb({ outDir = join(root, 'dist', 'web'), log = console.log } = {}) {
  const out = resolve(outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const items = ['index.html', 'style.css', 'src', 'vendor/three/build', 'vendor/three/examples/jsm', 'vendor/three/LICENSE',
    'assets/models', 'assets/textures', 'assets/manifest.json'];
  for (const it of items) {
    const from = join(root, it);
    if (!existsSync(from)) { if (['index.html', 'src', 'vendor/three/build'].includes(it)) throw new Error('missing required ' + it); log('WARN missing ' + it); continue; }
    mkdirSync(dirname(join(out, it)), { recursive: true });
    cpSync(from, join(out, it), { recursive: true });
  }
  // Avoid a /favicon.ico 404: point the game page at an inline empty icon (source index.html is not ours to edit).
  const ip = join(out, 'index.html'), html = readFileSync(ip, 'utf8');
  if (!/rel="icon"/.test(html)) writeFileSync(ip, html.replace('</head>', '  <link rel="icon" href="data:,">\n</head>'));
  const files = walk(out);
  const bytes = files.reduce((s, f) => s + statSync(f).size, 0);
  log(`web build: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB -> ${out}`);
  return { out, files: files.length, bytes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  buildWeb(i > 0 ? { outDir: process.argv[i + 1] } : {});
}
