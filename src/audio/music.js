// Synthwave sequencer: 16-bar loops (4/4, 16th grid), lookahead scheduling.
import { MUSIC } from '../core/defs.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// 16-bar progressions: 4 chords x 4 bars (root midi, minor/major triad)
const A = [[45, 0], [41, 1], [48, 1], [43, 1]]; // Am F C G
const B = [[40, 0], [45, 0], [36, 1], [43, 1]]; // Em Am C G
const SONGS = {
  title:    { bpm: 96,  prog: A, drums: 'soft', arp: 0.5, lead: true, bars: 16 },
  wave_a:   { bpm: 118, prog: A, drums: 'drive', arp: 1, lead: false, bars: 16 },
  wave_b:   { bpm: 132, prog: B, drums: 'drive', arp: 1, lead: true, bars: 16 },
  gameover: { bpm: 70,  prog: [[45, 0], [43, 0], [41, 1], [40, 0]], drums: 'none', arp: 0.25, lead: false, bars: 16, loop: false },
  hiscore:  { bpm: 124, prog: [[48, 1], [43, 1], [45, 0], [41, 1]], drums: 'drive', arp: 1, lead: true, bars: 16 },
};
export const SONG_BARS = Object.fromEntries(Object.entries(SONGS).map(([k, s]) => [k, s.bars]));

export function createMusic(ctx, out) {
  let cur = null, name = null, timer = null, step = 0, nextT = 0, gain = null;
  const hasTimers = typeof setInterval === 'function';

  const voice = (type, f, t, dur, vol, dest, det = 0) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  };
  let nbuf = null;
  const hat = (t, vol, dest, len = 0.04) => {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate >> 1, ctx.sampleRate); const d = nbuf.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = s / 2147483648 - 1; } }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = nbuf; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + len + 0.02);
  };
  const kick = (t, dest) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.22);
  };
  const snare = (t, dest) => { hat(t, 0.35, dest, 0.15); voice('triangle', 190, t, 0.1, 0.25, dest); };

  // Schedule one 16th-note step of the song at time t.
  function playStep(song, s, t, dest) {
    const bar = Math.floor(s / 16) % song.bars, sx = s % 16;
    const [root, maj] = song.prog[Math.floor(bar / 4) % song.prog.length];
    const third = maj ? 4 : 3, spb = 60 / song.bpm / 4;
    // bass: driving 8ths on root with octave bounce
    if (sx % 2 === 0) voice('sawtooth', mtof(root - 12 + (sx % 8 === 6 ? 12 : 0)), t, spb * 1.8, 0.22, dest);
    // arp: 16ths over chord tones
    if (song.arp && (song.arp >= 1 || sx % 4 === 0)) {
      const tones = [0, third, 7, 12, 7, third];
      voice('square', mtof(root + 12 + tones[(sx + (bar % 2)) % tones.length]), t, spb * 0.9, 0.06 * Math.min(1, song.arp + 0.5), dest);
    }
    // pad: one chord per bar
    if (sx === 0) for (const iv of [0, third, 7]) {
      voice('sawtooth', mtof(root + iv), t, spb * 15, 0.035, dest, -7);
      voice('sawtooth', mtof(root + iv), t, spb * 15, 0.035, dest, 7);
    }
    // lead: every 4th bar, simple motif
    if (song.lead && bar % 4 >= 2 && sx % 4 === 0) {
      const mot = [12, 14 - (maj ? 0 : 1), 19, 16 - (maj ? 0 : 1)];
      voice('triangle', mtof(root + 24 + mot[(sx / 4 + bar) % 4 | 0] - 12), t, spb * 3.5, 0.1, dest);
    }
    if (song.drums === 'drive') {
      if (sx % 4 === 0) kick(t, dest);
      if (sx === 4 || sx === 12) snare(t, dest);
      if (sx % 2 === 1 || sx % 4 === 2) hat(t, 0.08, dest);
    } else if (song.drums === 'soft') {
      if (sx === 0 || sx === 8) kick(t, dest);
      if (sx === 12) snare(t, dest);
      if (sx % 4 === 2) hat(t, 0.05, dest);
    }
  }

  function tick() {
    if (!cur) return;
    const spb = 60 / cur.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) {
      if (cur.loop === false && step >= cur.bars * 16) { cur = null; return stopTimer(); }
      playStep(cur, step, nextT, gain);
      nextT += spb; step++;
    }
  }
  function stopTimer() { if (timer != null) { clearInterval(timer); timer = null; } }

  return {
    get name() { return name; },
    bars: SONG_BARS,
    start(n) {
      this.stop();
      if (!MUSIC.includes(n) || !SONGS[n]) return false;
      cur = SONGS[n]; name = n; step = 0;
      gain = ctx.createGain(); gain.gain.value = 1; gain.connect(out);
      nextT = ctx.currentTime + 0.05;
      tick();
      if (hasTimers) { timer = setInterval(tick, 80); timer.unref?.(); }
      return true;
    },
    stop() {
      stopTimer();
      if (gain) { const g = gain, t = ctx.currentTime; try { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.3); } catch {} setTimeout?.(() => { try { g.disconnect(); } catch {} }, 400).unref?.(); }
      gain = null; cur = null; name = null;
    },
    tick,
  };
}
