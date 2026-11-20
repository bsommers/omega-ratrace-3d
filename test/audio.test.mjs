import assert from 'node:assert/strict';
import { SFX, MUSIC } from '../src/core/defs.js';
import { createBus } from '../src/core/events.js';
import { createAudio } from '../src/audio/audio.js';
import { createSfx } from '../src/audio/sfx.js';
import { createMusic, SONG_BARS } from '../src/audio/music.js';

// offline stub
const bus = createBus(); const a = createAudio({ bus });
for (const n of SFX) assert.ok(a.play(n, 400), n);
for (const n of MUSIC) assert.ok(a.music(n), n);
assert.equal(a.play('nope'), false);
bus.emit('sfx', { name: 'fire', x: 10 }); bus.emit('music', { name: 'title' });
assert.equal(a.currentMusic, 'title');
a.setVolume(0.5); a.muted = true; assert.equal(a.muted, true); await a.resume();

// fake ctx exercising all synth paths
let t = 0, nodes = 0;
const P = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
const N = () => { nodes++; return { connect() {}, disconnect() {}, start() {}, stop() {}, gain: P(), frequency: P(), detune: P(), Q: P(), pan: P() }; };
const ctx = { get currentTime() { return t; }, sampleRate: 8000, createOscillator: N, createGain: N, createBiquadFilter: N,
  createBufferSource: N, createBuffer: (c, n) => ({ sampleRate: 8000, getChannelData: () => new Float32Array(n) }) };
const s = createSfx(ctx, N());
for (const n of SFX) { t += 1; assert.ok(s.play(n), n); }
const m = createMusic(ctx, N());
for (const n of MUSIC) {
  assert.ok(SONG_BARS[n] >= 16);
  assert.ok(m.start(n)); for (let i = 0; i < 400; i++) { t += 0.1; m.tick(); }
  m.stop();
}
assert.ok(nodes > 1000);
console.log('audio ok, nodes', nodes);
