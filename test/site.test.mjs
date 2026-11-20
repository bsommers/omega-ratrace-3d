import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite } from '../tools/build-site.mjs';

const base = process.env.CLAUDE_CODE_TMPDIR || '/datanapps/claude-tmp';
test('site build assembles landing + play + stl', () => {
  const dir = mkdtempSync(join(existsSync(base) ? base : tmpdir(), 'site-test-'));
  try {
    const out = buildSite({ outDir: dir, log: () => {} });
    for (const f of ['index.html', 'favicon.svg', '.nojekyll', 'play/index.html', 'play/style.css', 'play/src/main.js',
      'play/vendor/three/build/three.module.js', 'play/assets/manifest.json', 'play/assets/models/colby.glb', 'stl/colby.stl'])
      assert.ok(existsSync(join(out, f)), f);
    const play = readFileSync(join(out, 'play/index.html'), 'utf8');
    assert.match(play, /"three": "\.\/vendor\/three\/build\/three\.module\.js"/);
    assert.ok(!/(src|href)="\//.test(play), 'play/index.html must use relative paths');
    const land = readFileSync(join(out, 'index.html'), 'utf8');
    for (const l of ['play/', 'img/hero.png', 'Quality tiers', 'Asset pipeline']) assert.ok(land.includes(l), l);
    for (const m of land.matchAll(/(?:src|href)="(img\/[^"]+)"/g)) assert.ok(existsSync(join(out, m[1])), m[1]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
