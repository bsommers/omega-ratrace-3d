// Quality tiers + FPS-driven auto-downgrade. Node-safe (no three import).
export const TIERS = ['low', 'medium', 'high', 'ultra'];
export const QUALITY_CFG = Object.freeze({
  low:    { post: false, gtao: false, bloom: false, smaa: false, grade: false, shadows: false, shadowMap: 512,  pixelRatio: 1,   particles: 1024, rimLights: 2, bloomScale: 0.5 },
  medium: { post: true,  gtao: false, bloom: true,  smaa: false, grade: true,  shadows: true,  shadowMap: 1024, pixelRatio: 1,   particles: 2048, rimLights: 4, bloomScale: 0.5 },
  high:   { post: true,  gtao: true,  bloom: true,  smaa: true,  grade: true,  shadows: true,  shadowMap: 2048, pixelRatio: 1.5, particles: 4096, rimLights: 6, bloomScale: 0.75 },
  ultra:  { post: true,  gtao: true,  bloom: true,  smaa: true,  grade: true,  shadows: true,  shadowMap: 4096, pixelRatio: 2,   particles: 8192, rimLights: 8, bloomScale: 1 },
});
export const normalizeQuality = q => (TIERS.includes(q) ? q : 'high');
export const configFor = q => QUALITY_CFG[normalizeQuality(q)];
export const downgrade = q => TIERS[Math.max(0, TIERS.indexOf(normalizeQuality(q)) - 1)];

// Feed frame dt (s) each frame. When the smoothed FPS stays < minFps for `window` seconds,
// calls onDowngrade(newTier). Cooldown avoids cascading drops before the change settles.
export function createAutoQuality({ quality = 'high', minFps = 40, window = 2.5, cooldown = 4, onDowngrade } = {}) {
  let q = normalizeQuality(quality), ema = 60, low = 0, cool = cooldown, enabled = true;
  return {
    get quality() { return q; }, get fps() { return ema; },
    set enabled(v) { enabled = !!v; }, setQuality(nq) { q = normalizeQuality(nq); low = 0; cool = cooldown; },
    tick(dt) {
      if (!enabled || !(dt > 0) || dt > 0.5) return q; // ignore hitches/tab-switches
      ema += (1 / dt - ema) * Math.min(1, dt * 2);
      if (cool > 0) { cool -= dt; return q; }
      if (ema < minFps && q !== 'low') {
        low += dt;
        if (low >= window) { q = downgrade(q); low = 0; cool = cooldown; ema = 60; onDowngrade?.(q); }
      } else low = Math.max(0, low - dt);
      return q;
    },
  };
}
