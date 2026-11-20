// Enemy behaviours: { init(e,g), update(e,dt,g), onDeath?(e,g) } keyed by kind. Engine integrates motion + wall bounces.
// Behaviours only steer (set vx/vy) and spawn. Randomness via g.rng only.
import { BOX, KINDS, TUNING } from '../core/defs.js';

const TAU = Math.PI * 2;
const sp = (k) => (KINDS[k] && KINDS[k].speed) || 0;
const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const alive = (s) => s && s.alive !== false && isFinite(s.x) && isFinite(s.y);

/** Rotate velocity toward heading `want` by at most maxTurn rad; hold speed `s`. */
function steer(e, want, maxTurn, s) {
  const cur = (e.vx || e.vy) ? Math.atan2(e.vy, e.vx) : want;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, wrapPi(want - cur)));
  e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s;
}

/** Does segment (ax,ay)-(bx,by) cross the BOX inflated by pad? (slab test) */
export function segHitsBox(ax, ay, bx, by, pad) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const test = (p, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi;
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    return t0 <= t1;
  };
  return test(ax, dx, BOX.x0 - pad, BOX.x1 + pad) && test(ay, dy, BOX.y0 - pad, BOX.y1 + pad);
}

/** Heading to chase (tx,ty) from e, detouring via a BOX corner if the box blocks the straight line. */
export function wallAwareHeading(e, tx, ty) {
  const pad = e.r + 6;
  if (!segHitsBox(e.x, e.y, tx, ty, pad)) return Math.atan2(ty - e.y, tx - e.x);
  const cs = [[BOX.x0 - pad, BOX.y0 - pad], [BOX.x1 + pad, BOX.y0 - pad], [BOX.x0 - pad, BOX.y1 + pad], [BOX.x1 + pad, BOX.y1 + pad]];
  let best = null, bd = Infinity;
  for (const [cx, cy] of cs) {
    const d = Math.hypot(cx - e.x, cy - e.y) + Math.hypot(tx - cx, ty - cy);
    const visible = !segHitsBox(e.x, e.y, cx, cy, pad - 1);
    const dd = visible ? d : d + 1000;
    if (dd < bd) { bd = dd; best = [cx, cy]; }
  }
  return Math.atan2(best[1] - e.y, best[0] - e.x);
}

function fireAt(e, g, ang, speed) {
  const E = TUNING.ebullet;
  const s = speed || E.speed;
  return g.spawn('ebullet', { x: e.x + Math.cos(ang) * (e.r + E.r + 1), y: e.y + Math.sin(ang) * (e.r + E.r + 1),
    vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, angle: ang, r: E.r, hp: 1, life: E.life, team: 'enemy' });
}

export const BEHAVIORS = {
  mouse: {
    init(e) {
      if (!e.vx && !e.vy) { const a = e.angle || 0; e.vx = Math.cos(a) * sp('mouse'); e.vy = Math.sin(a) * sp('mouse'); }
    },
    update(e) { // straight lines; engine bounces. Keep speed constant.
      const s = Math.hypot(e.vx, e.vy);
      if (s < 1e-6) { e.vx = sp('mouse'); e.vy = 0; } else if (Math.abs(s - sp('mouse')) > 0.5) { e.vx *= sp('mouse') / s; e.vy *= sp('mouse') / s; }
    },
  },

  rat: {
    init(e) { if (!e.vx && !e.vy) { const a = e.angle || 0; e.vx = Math.cos(a) * sp('rat'); e.vy = Math.sin(a) * sp('rat'); } },
    update(e, dt, g) {
      const s = g.ship;
      if (!alive(s)) return; // keep drifting
      const want = wallAwareHeading(e, s.x, s.y);
      steer(e, want, 2.6 * dt, sp('rat'));
    },
  },

  commander: {
    init(e, g) {
      e.fireT = 1.2 + g.rng.next() * 1.0; e.burst = 0; e.burstT = 0;
      if (!e.vx && !e.vy) { const a = e.angle || 0; e.vx = Math.cos(a) * sp('commander'); e.vy = Math.sin(a) * sp('commander'); }
    },
    update(e, dt, g) {
      const s = Math.hypot(e.vx, e.vy);
      if (s > 1e-6 && Math.abs(s - sp('commander')) > 0.5) { e.vx *= sp('commander') / s; e.vy *= sp('commander') / s; }
      const sh = g.ship;
      if (!alive(sh)) return;
      if (e.burst > 0) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          fireAt(e, g, Math.atan2(sh.y - e.y, sh.x - e.x) + (g.rng.next() - 0.5) * 0.12);
          g.sfx('ebullet');
          e.burst--; e.burstT = 0.14;
          if (e.burst === 0) e.fireT = 2.2 + g.rng.next() * 1.2;
        }
      } else {
        e.fireT -= dt;
        if (e.fireT <= 0) { e.burst = 3; e.burstT = 0; }
      }
    },
    onDeath(e, g) { g.spawn('tuna', { x: e.x, y: e.y, vx: 0, vy: 0, team: 'pickup' }); },
  },

  mine: {
    init(e, g) {
      e.armT = 1.5; e.armed = false;
      if (!e.vx && !e.vy) { const a = g.rng.next() * TAU; e.vx = Math.cos(a) * sp('mine'); e.vy = Math.sin(a) * sp('mine'); }
    },
    update(e, dt, g) {
      if (!e.armed) { e.armT -= dt; if (e.armT <= 0) e.armed = true; }
      else {
        const s = g.ship;
        if (alive(s) && Math.hypot(s.x - e.x, s.y - e.y) < e.r + 34) g.kill(e, { score: false });
      }
    },
    onDeath(e, g) {
      const a0 = g.rng.next() * TAU;
      for (let i = 0; i < 6; i++) fireAt(e, g, a0 + (i * TAU) / 6, TUNING.ebullet.speed * 0.8);
      g.sfx('mine_burst'); g.fx('crumbs', e.x, e.y, { kind: 'mine' });
    },
  },

  deathrat: {
    init(e) { e.hp = 1e9; if (!e.vx && !e.vy) { e.vx = sp('deathrat'); e.vy = 0; } },
    update(e, dt, g) {
      e.hp = 1e9; // unkillable
      const s = g.ship;
      if (!alive(s)) return;
      steer(e, wallAwareHeading(e, s.x, s.y), 3.4 * dt, sp('deathrat'));
    },
  },

  tuna: {
    init(e) { e.vx = 0; e.vy = 0; e.team = 'pickup'; },
    update(e) { e.vx = 0; e.vy = 0; if (e.t > 8) e.dead = true; },
  },
};

export default BEHAVIORS;
