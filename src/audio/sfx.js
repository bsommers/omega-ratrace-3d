// Procedural SFX: every name in defs.SFX. Pure WebAudio; ctx/out injected.
import { SFX } from '../core/defs.js';

let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const n = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
  return (noiseBuf = b);
}

export function createSfx(ctx, out) {
  // tone: freq f0->f1 over dur, optional delay `at`
  function tone(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur, v = o.vol ?? 0.3;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (o.atk ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.dest || out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function hiss(o) {
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise(ctx);
    f.type = o.ftype || 'lowpass';
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
    f.Q.value = o.q ?? 1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.3, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || out);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.02);
  }
  const arp = (notes, step, o) => notes.forEach((f, i) => tone({ ...o, f0: f, at: i * step }));

  const defs = {
    thrust: () => hiss({ f0: 500, f1: 200, dur: 0.12, vol: 0.12, q: 0.7 }),
    fire: () => { tone({ f0: 1200, f1: 280, dur: 0.1, type: 'sawtooth', vol: 0.18 }); hiss({ f0: 6000, f1: 1500, dur: 0.05, vol: 0.06, ftype: 'highpass' }); },
    bounce: () => { tone({ f0: 220, f1: 90, dur: 0.1, type: 'triangle', vol: 0.3 }); hiss({ f0: 900, f1: 300, dur: 0.05, vol: 0.1 }); },
    hit: () => { tone({ f0: 420, f1: 120, dur: 0.12, type: 'square', vol: 0.22 }); hiss({ f0: 3000, f1: 800, dur: 0.08, vol: 0.15 }); },
    boom_small: () => { hiss({ f0: 2500, f1: 200, dur: 0.3, vol: 0.4 }); tone({ f0: 140, f1: 40, dur: 0.25, type: 'sine', vol: 0.4 }); },
    boom_big: () => { hiss({ f0: 3000, f1: 80, dur: 0.9, vol: 0.55 }); tone({ f0: 100, f1: 28, dur: 0.8, type: 'sine', vol: 0.6 }); tone({ f0: 60, f1: 25, dur: 0.6, type: 'sawtooth', vol: 0.2, at: 0.05 }); },
    mine_burst: () => { hiss({ f0: 4000, f1: 400, dur: 0.35, vol: 0.35, ftype: 'bandpass', q: 3 }); tone({ f0: 800, f1: 100, dur: 0.3, type: 'sawtooth', vol: 0.2 }); },
    ebullet: () => tone({ f0: 700, f1: 500, dur: 0.12, type: 'triangle', vol: 0.15 }),
    pickup: () => arp([660, 880, 1320], 0.06, { dur: 0.12, type: 'square', vol: 0.18 }),
    bomb: () => { hiss({ f0: 6000, f1: 60, dur: 1.2, vol: 0.5 }); tone({ f0: 300, f1: 30, dur: 1.1, type: 'sawtooth', vol: 0.35 }); tone({ f0: 80, f1: 20, dur: 1.2, type: 'sine', vol: 0.5 }); },
    death: () => { tone({ f0: 600, f1: 40, dur: 1.0, type: 'sawtooth', vol: 0.35 }); hiss({ f0: 2000, f1: 100, dur: 0.9, vol: 0.4 }); },
    wave_start: () => arp([262, 330, 392, 523], 0.09, { dur: 0.2, type: 'sawtooth', vol: 0.2 }),
    wave_clear: () => arp([392, 523, 659, 784, 1047], 0.08, { dur: 0.25, type: 'square', vol: 0.18 }),
    extralife: () => arp([523, 659, 784, 1047, 1319, 1568], 0.07, { dur: 0.3, type: 'triangle', vol: 0.28 }),
    deathrat_warn: () => { for (let i = 0; i < 3; i++) tone({ f0: 220, f1: 180, dur: 0.22, type: 'sawtooth', vol: 0.3, at: i * 0.3 }); },
    menu_move: () => tone({ f0: 900, f1: 1100, dur: 0.05, type: 'square', vol: 0.12 }),
    menu_select: () => arp([600, 900], 0.06, { dur: 0.1, type: 'square', vol: 0.16 }),
    gameover: () => arp([392, 349, 311, 262, 196], 0.22, { dur: 0.5, type: 'sawtooth', vol: 0.22 }),
    hiscore: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.1, { dur: 0.25, type: 'square', vol: 0.2 }),
    launch: () => { tone({ f0: 80, f1: 700, dur: 0.5, type: 'sawtooth', vol: 0.25 }); hiss({ f0: 300, f1: 5000, dur: 0.5, vol: 0.2 }); },
  };
  for (const n of SFX) if (!defs[n]) defs[n] = () => tone({ f0: 440, dur: 0.1, vol: 0.1 });

  const last = {};
  const minGap = { thrust: 0.09, fire: 0.03, bounce: 0.04, hit: 0.03, ebullet: 0.04, menu_move: 0.03 };
  return {
    names: SFX,
    // play(name, dest): dest is an AudioNode (e.g. panner) overriding `out`
    play(name, dest) {
      const f = defs[name];
      if (!f) return false;
      const now = ctx.currentTime;
      if (minGap[name] && now - (last[name] ?? -9) < minGap[name]) return false;
      last[name] = now;
      const prev = out;
      if (dest) out = dest;
      try { f(); } finally { out = prev; }
      return true;
    },
  };
}
