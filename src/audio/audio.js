// createAudio({bus, settings?}) -> {resume,setVolume,play,music,muted}
// Browser: WebAudio. Node / no AudioContext: offline stub that records calls.
import { SFX, MUSIC, W } from '../core/defs.js';
import { createSfx } from './sfx.js';
import { createMusic } from './music.js';

const Ctor = typeof globalThis !== 'undefined' ? (globalThis.AudioContext || globalThis.webkitAudioContext) : null;

export function createAudio({ bus, settings } = {}) {
  const st = (settings && (settings.get ? settings.get() : settings)) || {};
  let master = st.master ?? 0.8, sfxVol = st.sfx ?? 1, musVol = st.music ?? 0.6;
  let muted = !!st.muted;
  const stub = { sfx: [], music: [], offline: true };
  let ctx = null, nodes = null, sfx = null, mus = null, wantMusic = null;

  function ensure() {
    if (ctx || !Ctor) return ctx;
    try {
      ctx = new Ctor();
      const m = ctx.createGain(), comp = ctx.createDynamicsCompressor(), s = ctx.createGain(), u = ctx.createGain();
      m.connect(comp); comp.connect(ctx.destination); s.connect(m); u.connect(m);
      nodes = { m, s, u };
      apply();
      sfx = createSfx(ctx, s); mus = createMusic(ctx, u);
      if (wantMusic) mus.start(wantMusic);
    } catch { ctx = null; }
    return ctx;
  }
  function apply() {
    if (!nodes) return;
    nodes.m.gain.value = muted ? 0 : master;
    nodes.s.gain.value = sfxVol; nodes.u.gain.value = musVol * 0.8;
  }

  const api = {
    get muted() { return muted; },
    set muted(v) { muted = !!v; apply(); },
    stub: Ctor ? null : stub,
    resume() { ensure(); return ctx && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve(); },
    setVolume(v, kind = 'master') {
      v = Math.max(0, Math.min(1, +v || 0));
      if (kind === 'sfx') sfxVol = v; else if (kind === 'music') musVol = v; else master = v;
      apply();
    },
    // play(name, x?) ; x in arena units [0,W] -> pan -1..1. Also accepts {name,x}.
    play(name, x) {
      if (name && typeof name === 'object') { x = name.x; name = name.name; }
      if (!SFX.includes(name)) return false;
      if (!ctx) { stub.sfx.push(name); if (!Ctor) return true; if (!ensure()) return true; }
      if (muted) return false;
      let dest;
      if (typeof x === 'number' && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (x / W) * 2 - 1) * 0.8);
        p.connect(nodes.s); dest = p;
      }
      return sfx.play(name, dest);
    },
    // music(name | null)
    music(name) {
      if (name && typeof name === 'object') name = name.name;
      if (name && !MUSIC.includes(name)) return false;
      wantMusic = name || null;
      stub.music.push(wantMusic);
      if (!ctx) return true;
      if (!wantMusic) mus.stop(); else if (mus.name !== wantMusic) mus.start(wantMusic);
      return true;
    },
    get currentMusic() { return wantMusic; },
  };
  if (bus) {
    bus.on('sfx', (p) => api.play(p));
    bus.on('music', (p) => api.music(p));
    bus.on('pause', (p) => { if (ctx) (p && (p.paused ?? p.on ?? p) ? ctx.suspend() : ctx.resume()); });
  }
  return api;
}
export default createAudio;
