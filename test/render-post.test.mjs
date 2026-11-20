import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAutoQuality, downgrade, configFor, TIERS } from '../src/render/quality.js';
import { QUALITY } from '../src/core/defs.js';
test('tiers match defs', () => { assert.deepEqual([...TIERS], [...QUALITY]); for (const t of TIERS) assert.ok(configFor(t).particles > 0); });
test('downgrade floors at low', () => { assert.equal(downgrade('ultra'), 'high'); assert.equal(downgrade('low'), 'low'); });
test('auto-downgrade on low fps', () => {
  const got = []; const a = createAutoQuality({ quality: 'ultra', cooldown: 0, onDowngrade: q => got.push(q) });
  for (let i = 0; i < 400; i++) a.tick(1 / 15);
  assert.ok(got.length >= 1 && got[0] === 'high');
});
test('no downgrade at 60fps', () => { const a = createAutoQuality({ quality: 'high', cooldown: 0 }); for (let i = 0; i < 600; i++) a.tick(1 / 60); assert.equal(a.quality, 'high'); });
