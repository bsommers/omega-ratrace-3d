// Colby ship physics.
import { TUNING } from '../core/defs.js';
import { bounceWalls } from './collide.js';

export function makeShip() {
  return { x: 400, y: 70, vx: 0, vy: 0, angle: 0, alive: true, invuln: 0, hull: 1, hullMax: 1, hitT: 0, thrusting: false, r: TUNING.ship.r };
}

export function updateShip(g, dt, input) {
  const s = g.ship, T = TUNING.ship;
  if (!s.alive) { s.hitT = 0; s.thrusting = false; return; }
  s.angle += (+input.rot || 0) * T.rotSpeed * dt;
  const th = input.thrust === true ? 1 : Math.max(0, Math.min(1, +input.thrust || 0));
  s.thrusting = th > 0;
  if (th > 0) {
    s.vx += Math.cos(s.angle) * T.thrust * th * dt;
    s.vy += Math.sin(s.angle) * T.thrust * th * dt;
  }
  const k = Math.exp(-T.drag * dt);
  s.vx *= k; s.vy *= k;
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > T.maxSpeed) { s.vx *= T.maxSpeed / sp; s.vy *= T.maxSpeed / sp; }
  s.x += s.vx * dt; s.y += s.vy * dt;
  const hit = bounceWalls(s, T.bounce);
  if (hit) { g.sfx('bounce'); g.fx('spark', s.x, s.y, {}); }
  if (s.hitT > 0) s.hitT = Math.max(0, s.hitT - dt);
  if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);
}
