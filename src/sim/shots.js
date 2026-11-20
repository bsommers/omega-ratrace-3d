// Player hairballs.
import { TUNING } from '../core/defs.js';
import { bounceWalls } from './collide.js';

export function tryFire(g, input, dt) {
  const s = g.ship, T = TUNING;
  g._fireCd = Math.max(0, g._fireCd - dt);
  if (!input.fire || !s.alive || g._fireCd > 0) return;
  let n = 0;
  for (const e of g.ents) if (e.kind === 'hairball' && !e.dead) n++;
  if (n >= T.ship.maxShots) return;
  g._fireCd = T.ship.fireCooldown;
  const c = Math.cos(s.angle), sn = Math.sin(s.angle);
  g.spawn('hairball', {
    x: s.x + c * (T.ship.r + 2), y: s.y + sn * (T.ship.r + 2),
    vx: c * T.shot.speed + s.vx * 0.3, vy: sn * T.shot.speed + s.vy * 0.3,
    angle: s.angle, team: 'player', rc: 0, life: T.shot.life,
  });
  g.sfx('fire');
}

/** Move a hairball; ricochet once off walls, then die. */
export function updateShot(g, e, dt) {
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.life -= dt;
  if (e.life <= 0) { g.kill(e, { silent: true }); return; }
  const hit = bounceWalls(e, 1);
  if (hit) {
    if (e.rc >= TUNING.shot.ricochets) { g.fx('spark', e.x, e.y, {}); g.kill(e, { silent: true }); return; }
    e.rc++; e.angle = Math.atan2(e.vy, e.vx);
    g.fx('spark', e.x, e.y, {}); g.sfx('bounce');
  }
}

export function updateEBullet(g, e, dt) {
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.life -= dt;
  if (e.life <= 0) { g.kill(e, { silent: true }); return; }
  const hit = bounceWalls(e, 1);
  if (hit) { g.fx('spark', e.x, e.y, {}); g.kill(e, { silent: true }); }
}
