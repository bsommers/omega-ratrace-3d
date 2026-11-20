// Simulation core. No three.js, no DOM. Randomness only via g.rng.
import { W, H, BOX, TICK, TUNING, KINDS } from '../core/defs.js';
import { createRng } from '../core/rng.js';
import { createBus } from '../core/events.js';
import { makeShip, updateShip } from './player.js';
import { tryFire, updateShot, updateEBullet } from './shots.js';
import { circleHit } from './collide.js';
import { addScore, tickCombo, resetCombo } from './score.js';
import { buildWave, waveName } from './waves.js';
import { bounceWalls } from './collide.js';

let BEHAVIORS = {};
/** Main wires sim-enemies here: setBehaviors(BEHAVIORS). Defaults to an empty map. */
export function setBehaviors(map) { BEHAVIORS = map || {}; }
export { buildWave };

const ENEMY = new Set(['mouse', 'rat', 'commander', 'mine']);

export function createGame({ seed = 1, bus = createBus(), startWave: startWaveN = 1 } = {}) {
  const g = {
    bus, rng: createRng(seed), seed,
    t: 0, state: 'intro', wave: startWaveN, score: 0, hiscore: 0, lives: TUNING.lives, bombs: TUNING.ship.bombs,
    combo: 0, comboT: 0, ship: makeShip(), ents: [],
    _id: 1, _fireCd: 0, _extraIdx: 0, _stateT: 0, _waveT: 0, _queue: [], _spawnCd: 0, _deathRat: false,
  };
  const emit = (t, p) => bus.emit(t, p);
  g.sfx = (name) => emit('sfx', { name });
  g.fx = (type, x, y, opts = {}) => emit('fx', { type, x, y, opts });
  g.popup = (text, x, y, color) => emit('popup', { text, x, y, color });
  g.shake = (mag, dur) => emit('shake', { mag, dur });

  g.spawn = (kind, props = {}) => {
    const K = KINDS[kind] || { r: 8, hp: 1, score: 0, speed: 0 };
    const e = { id: g._id++, kind, x: 0, y: 0, vx: 0, vy: 0, angle: 0, r: K.r, hp: K.hp, t: 0, dead: false,
      team: kind === 'hairball' ? 'player' : kind === 'tuna' ? 'pickup' : 'enemy', ...props };
    g.ents.push(e);
    const b = BEHAVIORS[kind];
    if (b && b.init) b.init(e, g);
    return e;
  };

  g.kill = (e, opts = {}) => {
    if (e.dead) return;
    e.dead = true;
    const silent = opts.silent;
    if (!silent) {
      const K = KINDS[e.kind];
      if (K && K.score > 0 && opts.score !== false) addScore(g, K.score, { x: e.x, y: e.y });
      if (ENEMY.has(e.kind) || e.kind === 'deathrat') {
        const big = e.kind === 'commander' || e.kind === 'deathrat';
        g.fx(big ? 'boom_big' : 'boom_small', e.x, e.y, { kind: e.kind });
        g.sfx(big ? 'boom_big' : 'boom_small');
        g.shake(big ? 6 : 2, big ? 0.3 : 0.12);
      }
    }
    const b = BEHAVIORS[e.kind];
    if (b && b.onDeath) b.onDeath(e, g);
  };

  g.hurt = (e, dmg = 1) => {
    if (e.dead || e.kind === 'deathrat') return;
    e.hp -= dmg;
    if (e.hp <= 0) g.kill(e);
    else { e.hit = 0.1; g.sfx('hit'); g.fx('spark', e.x, e.y, {}); }
  };

  function spawnFromBox(kind) {
    const { x0, y0, x1, y1 } = BOX, w = x1 - x0, h = y1 - y0;
    let p = g.rng.next() * 2 * (w + h), x, y, nx = 0, ny = 0;
    if (p < w) { x = x0 + p; y = y0; ny = -1; } else if ((p -= w) < h) { x = x1; y = y0 + p; nx = 1; }
    else if ((p -= h) < w) { x = x0 + p; y = y1; ny = 1; } else { p -= w; x = x0; y = y0 + p; nx = -1; }
    const K = KINDS[kind], sp = K.speed;
    const jitter = (g.rng.next() - 0.5) * 0.9;
    const a = Math.atan2(ny, nx) + jitter;
    return g.spawn(kind, { x: x + nx * (K.r + 1), y: y + ny * (K.r + 1), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, angle: a });
  }

  function startWave() {
    g.state = 'intro'; g._stateT = 0; g._waveT = 0; g._deathRat = false;
    g._queue = [];
    for (const ent of buildWave(g.wave, g.rng)) for (let i = 0; i < ent.count; i++) g._queue.push({ kind: ent.kind, delay: ent.delay });
    g._spawnCd = 0;
    const name = waveName(g.wave);
    emit('wave', { n: g.wave, name });
    emit('banner', { text: `WAVE ${g.wave}`, sub: name, dur: TUNING.introTime });
    g.sfx('wave_start');
  }

  function respawnShip() {
    const s = g.ship;
    Object.assign(s, { x: W / 2, y: 70, vx: 0, vy: 0, angle: 0, alive: true, invuln: TUNING.ship.invulnAfterDeath, thrusting: false });
    for (let i = g.ents.length - 1; i >= 0; i--) if (g.ents[i].kind === 'ebullet') g.ents[i].dead = true;
  }

  function killShip() {
    const s = g.ship;
    if (!s.alive || s.invuln > 0 || g.state === 'gameover') return;
    s.alive = false; s.thrusting = false;
    g.lives = Math.max(0, g.lives - 1);
    emit('life', { lives: g.lives });
    g.fx('boom_big', s.x, s.y, { kind: 'colby' }); g.sfx('death'); g.shake(10, 0.5);
    emit('flash', { color: '#ff2d55', a: 0.5, dur: 0.3 }); emit('hitstop', { ms: 90 });
    resetCombo(g);
    g._prevState = g.state;
    g.state = 'dying'; g._dyingT = TUNING.ship.dyingTime;
  }

  g.bomb = () => {
    if (g.bombs <= 0 || !g.ship.alive) return false;
    g.bombs--; emit('bombs', { n: g.bombs });
    g.sfx('bomb'); g.fx('ring', g.ship.x, g.ship.y, { radius: TUNING.bombRadius }); g.shake(12, 0.6);
    emit('flash', { color: '#fff3cf', a: 0.6, dur: 0.4 });
    const s = g.ship, R = TUNING.bombRadius;
    for (const e of [...g.ents]) {
      if (e.dead || e.kind === 'deathrat' || e.kind === 'tuna' || e.kind === 'hairball') continue;
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < R + e.r) { if (e.kind === 'ebullet') g.kill(e, { silent: true }); else g.kill(e); }
    }
    return true;
  };

  function collisions() {
    const s = g.ship;
    const list = g.ents;
    for (const a of list) {
      if (a.dead || a.kind !== 'hairball') continue;
      for (const b of list) {
        if (b.dead || a.dead) continue;
        if (ENEMY.has(b.kind) || b.kind === 'deathrat') {
          if (circleHit(a, b)) { g.kill(a, { silent: true }); g.fx('spark', a.x, a.y, {}); g.hurt(b, 1); if (b.kind === 'deathrat') g.sfx('hit'); }
        }
      }
    }
    if (!s.alive) return;
    for (const e of list) {
      if (e.dead) continue;
      if (e.kind === 'tuna') {
        if (circleHit(s, e)) {
          e.dead = true; g.sfx('pickup'); addScore(g, KINDS.tuna.score, { combo: false, x: e.x, y: e.y });
          if (g.bombs < 3) { g.bombs++; emit('bombs', { n: g.bombs }); }
        }
      } else if (ENEMY.has(e.kind) || e.kind === 'deathrat' || e.kind === 'ebullet') {
        if (circleHit(s, e)) {
          if (s.invuln > 0) continue;
          if (e.kind === 'ebullet') g.kill(e, { silent: true });
          else if (e.kind !== 'deathrat') g.kill(e);
          killShip(); return;
        }
      }
    }
  }

  function updateEnts(dt) {
    for (const e of g.ents) {
      if (e.dead) continue;
      e.t += dt;
      if (e.hit > 0) e.hit -= dt;
      if (e.kind === 'hairball') { updateShot(g, e, dt); continue; }
      if (e.kind === 'ebullet') { updateEBullet(g, e, dt); continue; }
      if (e.kind === 'tuna') { if (e.t > 8) e.dead = true; continue; }
      const b = BEHAVIORS[e.kind];
      if (b && b.update) b.update(e, dt, g);
      if (e.dead) continue;
      // engine integrates enemy motion and bounces off arena/box
      e.x += e.vx * dt; e.y += e.vy * dt;
      const hit = bounceWalls(e, TUNING.restitution[e.kind] ?? 1);
      if (hit) e.bounced = (e.bounced || 0) + 1;
      if (e.vx || e.vy) e.angle = Math.atan2(e.vy, e.vx);
    }
  }

  function enemiesAlive() {
    for (const e of g.ents) if (!e.dead && ENEMY.has(e.kind)) return true;
    return false;
  }

  function runWorld(dt, input) {
    updateShip(g, dt, input);
    if (g.state !== 'dying') tryFire(g, input, dt);
    if (input.bomb && g.state === 'play') g.bomb();
    if (g.ship.thrusting && Math.floor(g.t * 30) !== Math.floor((g.t - dt) * 30)) g.fx('thrust', g.ship.x, g.ship.y, { angle: g.ship.angle });
    updateEnts(dt);
    collisions();
    tickCombo(g, dt);
  }

  g.update = (dt = TICK, input = {}) => {
    if (input.pause) return;
    g.t += dt;
    if (g.state === 'gameover') { updateEnts(dt); sweep(); return; }
    if (g.state === 'intro') {
      g._stateT += dt;
      runWorld(dt, input);
      if (g._stateT >= TUNING.introTime) { g.state = 'play'; g._stateT = 0; }
    } else if (g.state === 'play') {
      g._waveT += dt;
      g._spawnCd -= dt;
      while (g._queue.length && g._spawnCd <= 0) {
        const q = g._queue.shift(); spawnFromBox(q.kind); g._spawnCd += q.delay;
      }
      if (!g._deathRat && g._waveT >= TUNING.deathRatAfter) {
        g._deathRat = true; spawnFromBox('deathrat');
        g.sfx('deathrat_warn'); emit('taunt', { text: 'The Death Rat comes for you!' });
      }
      runWorld(dt, input);
      if (g.state === 'play' && !g._queue.length && !enemiesAlive()) {
        g.state = 'waveclear'; g._stateT = 0;
        for (const e of g.ents) if (!e.dead && (e.kind === 'ebullet' || e.kind === 'deathrat')) e.dead = true;
        g.sfx('wave_clear'); emit('banner', { text: 'WAVE CLEAR', sub: '', dur: TUNING.waveClearDelay });
      }
    } else if (g.state === 'dying') {
      g._dyingT -= dt;
      runWorld(dt, input);
      if (g._dyingT <= 0 && g.state === 'dying') {
        if (g.lives > 0) { respawnShip(); g.state = g._prevState === 'intro' ? 'intro' : 'play'; }
        else { g.state = 'gameover'; emit('gameover', { score: g.score }); g.sfx('gameover'); }
      }
    } else if (g.state === 'waveclear') {
      g._stateT += dt;
      runWorld(dt, input);
      if (g._stateT >= TUNING.waveClearDelay) { g.wave++; startWave(); }
    }
    sweep();
  };

  function sweep() {
    let j = 0;
    for (let i = 0; i < g.ents.length; i++) if (!g.ents[i].dead) g.ents[j++] = g.ents[i];
    g.ents.length = j;
  }

  /** FNV-1a over quantised state. */
  g.hash = () => {
    let h = 0x811c9dc5 >>> 0;
    const mix = (v) => { h = Math.imul(h ^ (Math.round(v * 1000) | 0), 0x01000193) >>> 0; };
    const s = g.ship;
    [g.t, g.score, g.lives, g.bombs, g.combo, g.wave, s.x, s.y, s.vx, s.vy, s.angle, s.alive ? 1 : 0, s.invuln, g.rng.state].forEach(mix);
    for (const e of g.ents) [e.id, e.x, e.y, e.vx, e.vy, e.hp, e.t].forEach(mix);
    for (const c of g.state) mix(c.charCodeAt(0));
    return h.toString(16).padStart(8, '0');
  };

  startWave();
  return g;
}
