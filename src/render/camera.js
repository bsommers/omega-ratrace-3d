// Tilted arena camera with slow parallax drift and trauma-style shake. Pure three.js, no DOM.
import * as THREE from 'three';
import { W, H, WORLD_SCALE as S } from '../core/defs.js';

const TILT = 67 * Math.PI / 180; // angle of view direction below horizon

export function createCamera(aspect = 16 / 9) {
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 200);
  const st = { aspect, shakeMag: 0, shakeT: 0, shakeDur: 0, t: 0, dist: 20, shakeScale: 1, focus: new THREE.Vector3() };

  function fit() {
    // distance so the full arena (+margin) fits both vertically and horizontally for the current aspect
    const vfov = camera.fov * Math.PI / 180;
    const halfH = (H * S / 2) * 1.12, halfW = (W * S / 2) * 1.14;
    const needV = halfH / Math.sin(TILT) / Math.tan(vfov / 2) * 0.62 + 1;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * st.aspect);
    const needH = halfW / Math.tan(hfov / 2);
    st.dist = Math.max(needV, needH);
  }
  function resize(a) { st.aspect = camera.aspect = a || st.aspect; camera.updateProjectionMatrix(); fit(); }
  function shake(mag, dur) {
    // mag in sim units (~2..12); convert to a 0..1 trauma-ish amplitude
    const m = Math.min(1.5, (mag || 0) / 10);
    if (m >= st.shakeMag * Math.max(0, 1 - st.shakeT / Math.max(st.shakeDur, 1e-3))) { st.shakeMag = m; st.shakeT = 0; st.shakeDur = Math.max(0.05, dur || 0.2); }
  }
  function update(dt, g, opts = {}) {
    st.t += dt;
    st.shakeScale = opts.shakeScale ?? 1;
    // subtle drift + slight follow of ship for parallax
    const sx = g?.ship ? (g.ship.x / W - 0.5) : 0, sy = g?.ship ? (g.ship.y / H - 0.5) : 0;
    const dx = Math.sin(st.t * 0.23) * 0.18 + sx * 0.5, dz = Math.cos(st.t * 0.17) * 0.12 + sy * 0.3;
    let sh = 0, ox = 0, oy = 0;
    if (st.shakeMag > 0) {
      st.shakeT += dt;
      const k = Math.max(0, 1 - st.shakeT / st.shakeDur);
      if (k <= 0) st.shakeMag = 0;
      sh = st.shakeMag * k * k * 0.35 * st.shakeScale;
      ox = (Math.sin(st.t * 91) + Math.sin(st.t * 57.3)) * 0.5 * sh;
      oy = (Math.cos(st.t * 83) + Math.sin(st.t * 61.7)) * 0.5 * sh;
    }
    const d = st.dist;
    st.focus.set(dx, 0, dz + 0.35);
    camera.position.set(st.focus.x + ox, st.focus.y + Math.sin(TILT) * d + oy, st.focus.z + Math.cos(TILT) * d);
    camera.lookAt(st.focus.x, 0, st.focus.z);
    camera.rotateZ(ox * 0.04);
  }
  resize(aspect);
  return { camera, update, resize, shake, state: st };
}
