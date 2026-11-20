// Collision helpers (pure, no deps beyond defs).
import { W, H, BOX } from '../core/defs.js';

export function circleHit(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

export function circleRect(cx, cy, cr, x0, y0, x1, y1) {
  const px = Math.max(x0, Math.min(cx, x1)), py = Math.max(y0, Math.min(cy, y1));
  const dx = cx - px, dy = cy - py;
  return dx * dx + dy * dy < cr * cr;
}

/**
 * Bounce entity e (x,y,vx,vy,r) off the arena rect and the solid BOX.
 * Returns 0 (no hit), 1 (arena wall) or 2 (box). `rest` = restitution.
 */
export function bounceWalls(e, rest = 1) {
  let hit = 0;
  const r = e.r;
  if (e.x < r) { e.x = r; if (e.vx < 0) e.vx = -e.vx * rest; hit = 1; }
  else if (e.x > W - r) { e.x = W - r; if (e.vx > 0) e.vx = -e.vx * rest; hit = 1; }
  if (e.y < r) { e.y = r; if (e.vy < 0) e.vy = -e.vy * rest; hit = 1; }
  else if (e.y > H - r) { e.y = H - r; if (e.vy > 0) e.vy = -e.vy * rest; hit = 1; }
  const { x0, y0, x1, y1 } = BOX;
  if (e.x > x0 - r && e.x < x1 + r && e.y > y0 - r && e.y < y1 + r) {
    const px = Math.max(x0, Math.min(e.x, x1)), py = Math.max(y0, Math.min(e.y, y1));
    let dx = e.x - px, dy = e.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      let nx, ny;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; e.x = px + nx * r; e.y = py + ny * r; }
      else { // centre inside box: push out along min penetration axis
        const l = e.x - x0, rr = x1 - e.x, t = e.y - y0, b = y1 - e.y, m = Math.min(l, rr, t, b);
        if (m === l) { nx = -1; ny = 0; e.x = x0 - r; } else if (m === rr) { nx = 1; ny = 0; e.x = x1 + r; }
        else if (m === t) { nx = 0; ny = -1; e.y = y0 - r; } else { nx = 0; ny = 1; e.y = y1 + r; }
      }
      const vn = e.vx * nx + e.vy * ny;
      if (vn < 0) { e.vx -= (1 + rest) * vn * nx; e.vy -= (1 + rest) * vn * ny; }
      hit = 2;
    }
  }
  return hit;
}

export function inBox(x, y, pad = 0) {
  return x > BOX.x0 - pad && x < BOX.x1 + pad && y > BOX.y0 - pad && y < BOX.y1 + pad;
}
