import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs'; import { resolve, dirname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
test('README relative links and images resolve', () => {
  const s = readFileSync(resolve(root, 'README.md'), 'utf8');
  const links = [...s.matchAll(/\]\((?!https?:|#)([^)\s]+)\)/g)].map(m => m[1]);
  assert.ok(links.length > 8);
  for (const l of links) assert.ok(existsSync(resolve(root, l)), 'missing ' + l);
  assert.match(s, /bsommers\.github\.io\/omega-ratrace-3d\/play\//);
});
test('owned docs exist and non-trivial', () => {
  for (const f of ['docs/HOW-TO-PLAY.md', 'docs/LEARNINGS.md', 'docs/ARCH-OVERVIEW.md']) assert.ok(readFileSync(resolve(root, f), 'utf8').length > 500, f);
});
test('docs numbers match defs', async () => {
  const { TUNING, KINDS } = await import('../src/core/defs.js');
  const h = readFileSync(resolve(root, 'docs/HOW-TO-PLAY.md'), 'utf8');
  assert.ok(h.includes(String(TUNING.bombRadius)) && h.includes(String(TUNING.deathRatAfter)));
  assert.ok(h.includes(String(KINDS.commander.score)));
});
