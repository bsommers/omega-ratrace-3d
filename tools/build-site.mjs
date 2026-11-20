#!/usr/bin/env node
// Assemble the GitHub Pages site: node tools/build-site.mjs [--out dir]
//   dist/site/           landing page (docs/site)
//   dist/site/play/      web build (tools/build-web.mjs)
//   dist/site/stl/       print-ready STL models
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb } from './build-web.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function buildSite({ outDir = join(root, 'dist', 'site'), log = console.log } = {}) {
  const out = resolve(outDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'docs', 'site'), out, { recursive: true });
  buildWeb({ outDir: join(out, 'play'), log });
  const stl = join(root, 'assets', 'print');
  if (existsSync(stl)) cpSync(stl, join(out, 'stl'), { recursive: true, filter: (s) => !statSync(s).isFile() || s.endsWith('.stl') });
  else log('WARN assets/print missing; no STL downloads');
  writeFileSync(join(out, '.nojekyll'), '');
  for (const need of ['index.html', 'play/index.html', 'play/src/main.js', 'play/vendor/three/build/three.module.js', 'play/assets/models']) {
    if (!existsSync(join(out, need))) throw new Error('site missing ' + need);
  }
  log(`site: ${out} (${readdirSync(out).join(', ')})`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  buildSite(i > 0 ? { outDir: process.argv[i + 1] } : {});
}
