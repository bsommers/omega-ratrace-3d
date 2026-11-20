// Omega Ratrace 3D entry: fixed-step loop wiring sim + renderer + audio + UI. URL: autostart seed wave quality bot debug mute
import { TICK, W, H, PALETTE } from './core/defs.js';
import { createBus } from './core/events.js';
import { getSettings, setSettings } from './core/settings.js';
import { createInput, isTouchDevice } from './core/input.js';
import { createGame, setBehaviors } from './sim/game.js';
import { BEHAVIORS } from './sim/enemies.js';
setBehaviors(BEHAVIORS);
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createOptions } from './ui/menus.js';
import { applyFont } from './ui/font.js';

const P = new URLSearchParams(location.search);
const num = (k, d) => (P.has(k) && Number.isFinite(+P.get(k)) ? +P.get(k) : d);
const flag = k => P.has(k) && P.get(k) !== '0' && P.get(k) !== 'false';
const opt = { autostart: flag('autostart'), seed: num('seed', (Date.now() & 0xffff) || 1), wave: Math.max(1, num('wave', 1) | 0), bot: flag('bot'), debug: flag('debug') };
if (P.has('quality')) setSettings({ quality: P.get('quality') });
if (flag('mute')) setSettings({ muted: true });

const bus = createBus();
let canvas = document.getElementById('game');
const ui = document.getElementById('ui');
applyFont();
const optional = async (p) => { try { return await import(p); } catch (e) { console.warn('optional module missing', p, e?.message); return null; } };

// Minimal 2D fallback renderer so the game is playable if render-scene is absent/broken.
function fallbackRenderer(cv) {
  const c = cv.getContext('2d'); const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit();
  return { async load() {}, resize: fit, setQuality() {}, shot: () => cv.toDataURL(), dispose() {},
    draw(g) {
      const s = Math.min(cv.width / W, cv.height / H), ox = (cv.width - W * s) / 2, oy = (cv.height - H * s) / 2;
      c.fillStyle = PALETTE.bg; c.fillRect(0, 0, cv.width, cv.height); c.save(); c.translate(ox, oy); c.scale(s, s);
      c.strokeStyle = PALETTE.wall; c.lineWidth = 2; c.strokeRect(0, 0, W, H); c.strokeStyle = PALETTE.cheese; c.strokeRect(190, 130, 420, 190);
      for (const e of g.ents) { c.fillStyle = PALETTE[e.kind] || '#fff'; c.beginPath(); c.arc(e.x, e.y, e.r || 5, 0, 7); c.fill(); }
      const sh = g.ship; if (sh.alive) { c.save(); c.translate(sh.x, sh.y); c.rotate(sh.angle); c.fillStyle = PALETTE.colby; c.beginPath(); c.moveTo(14, 0); c.lineTo(-10, 9); c.lineTo(-10, -9); c.fill(); c.restore(); }
      c.restore();
    } };
}

async function boot() {
  const input = createInput(window, { touchRoot: (() => { const d = document.createElement('div'); d.className = 'touch' + (isTouchDevice() ? ' on' : ''); ui.appendChild(d); return d; })() });
  const hud = createHud(ui, bus);
  const settings = getSettings();

  // Renderer (render-scene) with fallback.
  let renderer = null;
  const rmod = await optional('./render/renderer.js');
  try { if (rmod?.createRenderer) { renderer = rmod.createRenderer(canvas, { bus, settings }); await renderer.load?.(); } } catch (e) {
    console.warn('renderer failed, 2D fallback', e); renderer = null;
    const c2 = canvas.cloneNode(); canvas.replaceWith(c2); canvas = c2;
  }
  renderer ||= fallbackRenderer(canvas);
  renderer.setQuality?.(settings.quality);

  // Audio (optional, unlocked on first gesture).
  const amod = await optional('./audio/audio.js');
  let audio = null; try { audio = amod?.createAudio?.({ bus, settings }) ?? null; } catch (e) { console.warn('audio failed', e); }
  const unlock = () => { audio?.resume?.(); audio?.unlock?.(); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock, { once: true });
  const applyAudio = () => { const s = getSettings(); audio?.setVolume?.(s.muted ? 0 : s.master); audio?.setSettings?.(s); audio?.setMuted?.(s.muted); };
  applyAudio();

  // Autopilot (qa-bot), optional.
  const apmod = opt.bot ? await optional('./sim/autopilot.js') : null;
  const botFn = apmod ? (apmod.createAutopilot?.() ?? apmod.autopilot ?? apmod.default) : null;
  const botInput = g => { try { if (typeof botFn === 'function') return botFn(g); return botFn?.think?.(g) ?? botFn?.update?.(g) ?? null; } catch { return null; } };

  let g = null, mode = 'title', hitstop = 0, overT = 0, acc = 0, last = performance.now(), frames = 0, fpsT = 0, fps = 0;
  bus.on('hitstop', p => { hitstop = Math.max(hitstop, (p?.ms ?? 0) / 1000); });
  const newGame = () => { g = createGame({ seed: opt.seed, bus, startWave: opt.wave }); window.__game = g; };
  const options = createOptions(ui, { onChange: (k, v, s) => { if (k === 'quality') renderer.setQuality?.(v); applyAudio(); }, onClose: () => { if (mode === 'paused') screens.showPause(); else if (mode === 'title') screens.showTitle(); } });
  const screens = createScreens(ui, {
    onStart: () => start(), onResume: () => setPaused(false), onOptions: () => { screens.hide(); options.show(); },
    onQuit: () => { mode = 'title'; newGame(); hud.hide(); screens.showTitle(); bus.emit('music', { name: 'title' }); },
  });
  function start() { newGame(); mode = 'play'; overT = 0; screens.hide(); hud.show(); bus.emit('music', { name: 'wave_a' }); }
  function setPaused(p) {
    if (p && mode === 'play') { mode = 'paused'; screens.showPause(); bus.emit('pause', { paused: true }); }
    else if (!p && mode === 'paused') { mode = 'play'; screens.hide(); bus.emit('pause', { paused: false }); }
  }
  input.onAction(a => {
    if (a === 'mute') { setSettings({ muted: !getSettings().muted }); applyAudio(); options.syncMute(); }
    else if (a === 'pause') { if (options.open) options.close(); else if (mode === 'play') setPaused(true); else if (mode === 'paused') setPaused(false); }
    else if (a === 'confirm' && mode === 'title' && !options.open && document.activeElement?.tagName !== 'BUTTON') start();
  });
  addEventListener('blur', () => setPaused(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); last = performance.now(); });
  addEventListener('resize', () => renderer.resize?.());
  addEventListener('orientationchange', () => setTimeout(() => renderer.resize?.(), 200));
  renderer.resize?.();

  newGame(); document.getElementById('loading')?.remove();
  if (opt.autostart) start(); else screens.showTitle();

  const idle = { rot: 0, thrust: 0, fire: false, bomb: false };
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const inp = input.poll();
    if (mode === 'play' || mode === 'title') {
      if (hitstop > 0) hitstop -= dt; else acc += dt;
      while (acc >= TICK) {
        acc -= TICK;
        const bi = (opt.bot || mode === 'title') ? botInput(g) : null;
        g.update(TICK, mode === 'title' ? (bi || idle) : (bi || inp));
        if (mode === 'play' && g.state === 'gameover') break;
      }
      if (mode === 'title' && g.state === 'gameover') newGame();
      if (mode === 'play' && g.state === 'gameover') { overT += dt; if (overT > 1.6) { mode = 'over'; hud.hide(); screens.showGameOver(g.score); } }
    }
    renderer.draw(g, mode === 'paused' ? 0 : acc / TICK, dt);
    frames++; fpsT += dt; if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    if (mode === 'play' || mode === 'paused') hud.update(g, opt.debug ? `fps ${fps}\nstate ${g.state}\nents ${g.ents.length}\nq ${getSettings().quality}` : '');
  }
  window.__omega = { get mode() { return mode; }, start, setPaused, input, bus, screens, options, opt };
  requestAnimationFrame(frame);
}
boot().catch(e => { console.error(e); const l = document.querySelector('.loading-sub'); if (l) l.textContent = 'Failed to start: ' + e.message; });
