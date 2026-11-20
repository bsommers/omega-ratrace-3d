// Deterministic autopilot. Pure function of game state: no randomness, no DOM. createAutopilot(opts) -> { step(g) -> input }.
import { W, H, BOX, TUNING } from '../core/defs.js';

const THREAT = new Set(['mouse', 'rat', 'commander', 'mine', 'deathrat', 'ebullet']);
const TARGET = new Set(['mouse', 'rat', 'commander', 'mine']);
const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function segHitsBox(ax, ay, bx, by, pad = 4) {
  const x0 = BOX.x0 - pad, y0 = BOX.y0 - pad, x1 = BOX.x1 + pad, y1 = BOX.y1 + pad;
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) { if (q < 0) return false; } else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
}
const WAYPOINTS = [[90, 65], [710, 65], [710, 385], [90, 385]];

export function createAutopilot(opts = {}) {
  const o = { danger: 70, aimTol: 0.12, bombDanger: 4, ...opts };
  let bombCd = 0;
  function step(g) {
    const s = g.ship, input = { rot: 0, thrust: false, fire: false, bomb: false };
    if (!s || !s.alive || g.state === 'gameover') return input;
    if (bombCd > 0) bombCd--;
    // Dodge: sum repulsion from threats on a closing course.
    let ax = 0, ay = 0, close = 0, nearest = null, nd = 1e9, tuna = null, td = 1e9;
    for (const e of g.ents) {
      if (e.dead) continue;
      if (e.kind === 'tuna') { const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < td) { td = d; tuna = e; } continue; }
      if (TARGET.has(e.kind)) {
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      if (!THREAT.has(e.kind)) continue;
      const rx = e.x - s.x, ry = e.y - s.y, rvx = e.vx - s.vx, rvy = e.vy - s.vy;
      const d = Math.hypot(rx, ry) || 1e-6;
      const v2 = rvx * rvx + rvy * rvy;
      let tca = v2 > 1e-6 ? -(rx * rvx + ry * rvy) / v2 : 0;
      tca = Math.max(0, Math.min(tca, 0.8));
      const cx = rx + rvx * tca, cy = ry + rvy * tca;
      const cd = Math.hypot(cx, cy);
      const lim = e.r + s.r + o.danger * (e.kind === 'deathrat' ? 1.5 : 1);
      if (cd < lim || d < lim) {
        const w = (lim - Math.min(cd, d)) / lim / (0.15 + tca);
        const sx = (cd > 1e-3 ? -cx / cd : -rx / d), sy = (cd > 1e-3 ? -cy / cd : -ry / d);
        // prefer sidestep perpendicular to approach
        const px = -ry / d, py = rx / d, side = (px * sx + py * sy) >= 0 ? 1 : -1;
        ax += (sx * 0.6 + px * side * 0.8) * w; ay += (sy * 0.6 + py * side * 0.8) * w;
        if (d < e.r + s.r + 45) close++;
      }
    }
    // Wall/box avoidance (soft).
    const m = 70;
    if (s.x < m) ax += (m - s.x) / m; if (s.x > W - m) ax -= (s.x - (W - m)) / m;
    if (s.y < m) ay += (m - s.y) / m; if (s.y > H - m) ay -= (s.y - (H - m)) / m;
    const bx = Math.max(BOX.x0, Math.min(s.x, BOX.x1)), by = Math.max(BOX.y0, Math.min(s.y, BOX.y1));
    const bd = Math.hypot(s.x - bx, s.y - by);
    if (bd < m && bd > 1e-3) { ax += (s.x - bx) / bd * (m - bd) / m; ay += (s.y - by) / bd * (m - bd) / m; }
    if (tuna && td < 160 && !close) { ax += (tuna.x - s.x) / td * 0.8; ay += (tuna.y - s.y) / td * 0.8; }
    // Roam: if the nearest target is hidden behind the box, travel to a ring corner with a clear line to it.
    let roam = false;
    if (nearest && Math.hypot(ax, ay) < 0.3 && segHitsBox(s.x, s.y, nearest.x, nearest.y)) {
      let goal = null, gd = 1e9;
      for (const w of WAYPOINTS) {
        if (segHitsBox(w[0], w[1], nearest.x, nearest.y)) continue;
        const d = Math.hypot(w[0] - s.x, w[1] - s.y); if (d < gd) { gd = d; goal = w; }
      }
      let best = null;
      if (goal) {
        if (!segHitsBox(s.x, s.y, goal[0], goal[1])) best = goal;
        else { let bd2 = 1e9; for (const w of WAYPOINTS) {
          if (w === goal || segHitsBox(s.x, s.y, w[0], w[1]) || Math.hypot(w[0] - s.x, w[1] - s.y) < 40) continue;
          const d = Math.hypot(w[0] - goal[0], w[1] - goal[1]); if (d < bd2) { bd2 = d; best = w; } } }
      }
      if (best) { roam = true; const dx = best[0] - s.x, dy = best[1] - s.y, d = Math.hypot(dx, dy);
        ax += dx / d * 0.7 - s.vx / 330 * 0.9; ay += dy / d * 0.7 - s.vy / 330 * 0.9; }
    }
    const mag = Math.hypot(ax, ay);
    const dodging = mag > 0.35 || (roam && mag > 0.15);
    // Aim: predicted intercept of nearest target (or flee heading when dodging hard).
    let want = s.angle;
    if (nearest) {
      const t = Math.min(1, nd / TUNING.shot.speed);
      want = Math.atan2(nearest.y + nearest.vy * t - s.y, nearest.x + nearest.vx * t - s.x);
    }
    let thrustDir = dodging ? Math.atan2(ay, ax) : null;
    let aim = want;
    // When dodging, steer toward the escape heading only if a target is not nearly lined up.
    const aimErr = nearest ? Math.abs(norm(want - s.angle)) : 9;
    if (dodging && (mag > 1.2 || aimErr > 0.6 || (roam && aimErr > 0.3))) aim = thrustDir;
    const err = norm(aim - s.angle);
    input.rot = Math.max(-1, Math.min(1, err * 8));
    if (dodging) input.thrust = Math.abs(norm(thrustDir - s.angle)) < 0.9 ? Math.min(1, mag) : false;
    else if (Math.hypot(s.vx, s.vy) > 120) {
      // brake: face against velocity is costly; simply coast (drag is low) unless near a wall handled above
      input.thrust = false;
    }
    if (nearest && !segHitsBox(s.x, s.y, nearest.x, nearest.y)) input.fire = Math.abs(norm(want - s.angle)) < o.aimTol + 0.5 / Math.max(40, nd) * 8;
    if (close >= 2 && g.bombs > 0 && g.state === 'play' && bombCd === 0 && s.invuln <= 0) { input.bomb = true; bombCd = 60; }
    else if (close >= o.bombDanger && g.bombs > 0 && g.state === 'play') input.bomb = true;
    return input;
  }
  return { step };
}
export default createAutopilot;
