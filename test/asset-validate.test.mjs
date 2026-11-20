import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const run = (...a) => spawnSync('node', ['tools/validate-assets.mjs', '--no-blender', '--no-write', ...a], { encoding: 'utf8' });

test('GLB structural check passes for shipped models', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
});

test('tiny tri budget fails with non-zero exit', () => {
  const r = run('--tri-budget=10');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /budget/);
});
