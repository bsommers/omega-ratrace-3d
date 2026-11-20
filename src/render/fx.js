// GPU particle FX: one Points object, ring-buffer pool, analytic motion in the vertex shader.
import * as THREE from 'three';
import { W, H, WORLD_SCALE as S, FX_TYPES } from '../core/defs.js';
import { configFor } from './quality.js';

const VS = `
attribute vec3 aVel; attribute vec4 aLife; // x birth, y life, z size0, w grow
attribute vec4 aCol; attribute vec2 aMisc;  // aCol rgb + alpha; aMisc x shape, y gravity
uniform float uTime, uScale, uDrag; varying vec4 vCol; varying float vShape, vAge, vRot;
void main(){
  float a = uTime - aLife.x; float u = a / aLife.y; vAge = u; vShape = aMisc.x; vRot = aLife.x * 7.;
  if (a < 0. || u >= 1.) { gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 0.; vCol = vec4(0.); return; }
  float k = uDrag; float dist = k > 0. ? (1.-exp(-k*a))/k : a;
  vec3 p = position + aVel*dist; p.y += -.5*aMisc.y*a*a;
  p.y = max(p.y, 0.02);
  vec4 mv = modelViewMatrix * vec4(p,1.);
  gl_Position = projectionMatrix * mv;
  float sz = (aLife.z + aLife.w*a) * (1. - u*u*.6);
  gl_PointSize = clamp(sz * uScale / -mv.z, 1., 256.);
  vCol = vec4(aCol.rgb, aCol.a * (1.-u) * min(1., a*30.));
}`;
const FS = `
varying vec4 vCol; varying float vShape, vAge, vRot;
void main(){
  vec2 p = gl_PointCoord - .5; float r = length(p); float a;
  if (vShape < .5) a = smoothstep(.5,.0,r);                       // soft glow disc
  else if (vShape < 1.5) a = smoothstep(.5,.42,r)*smoothstep(.30,.42,r)*1.2; // ring
  else { float c=cos(vRot), s=sin(vRot); vec2 q=mat2(c,-s,s,c)*p; a = step(abs(q.x),.28)*step(abs(q.y),.16); } // confetti
  if (a < .01) discard;
  gl_FragColor = vec4(vCol.rgb * (1.+ (1.-vAge)*1.5) , vCol.a * a);
}`;

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a); // visual-only randomness (not sim state)
const CRUMB = [[1, .72, .15], [1, .55, .1], [.95, .85, .4]];
const CONF = [[1, .17, .84], [.1, .9, 1], [1, .69, .18], [.48, .36, 1], [.4, 1, .5]];
const toWorld = (x, y) => [x * S - W * S / 2, y * S - H * S / 2];
const rgb = c => { if (c == null) return null; const t = new THREE.Color(c); return [t.r, t.g, t.b]; };

export function createFx(scene, bus, { quality = 'high', max } = {}) {
  let N = max || configFor(quality).particles;
  const geo = new THREE.BufferGeometry();
  let A = {};
  function alloc(n) {
    N = n;
    A = {
      position: new Float32Array(n * 3), aVel: new Float32Array(n * 3), aLife: new Float32Array(n * 4),
      aCol: new Float32Array(n * 4), aMisc: new Float32Array(n * 2),
    };
    const dims = { position: 3, aVel: 3, aLife: 4, aCol: 4, aMisc: 2 };
    for (const k in A) { const at = new THREE.BufferAttribute(A[k], dims[k]); at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at); }
    for (let i = 0; i < n; i++) A.aLife[i * 4] = -1e9;
    geo.setDrawRange(0, n);
  }
  alloc(N);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uDrag: { value: 1.2 } },
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'fx'; pts.renderOrder = 10;
  scene.add(pts);
  let T = 0, head = 0, dirty = false;

  function put(x, y, z, vx, vy, vz, life, size, grow, col, alpha, shape, grav) {
    const i = head; head = (head + 1) % N;
    A.position.set([x, y, z], i * 3); A.aVel.set([vx, vy, vz], i * 3);
    A.aLife.set([T, life, size, grow], i * 4); A.aCol.set([col[0], col[1], col[2], alpha], i * 4); A.aMisc.set([shape, grav], i * 2);
    dirty = true;
  }
  const burst = (x, y, n, o) => {
    for (let k = 0; k < n; k++) {
      const th = rnd(0, 6.283), sp = rnd(o.sp[0], o.sp[1]), up = rnd(o.up[0], o.up[1]);
      const col = o.cols ? o.cols[(Math.random() * o.cols.length) | 0] : o.col;
      put(x, rnd(0.05, 0.25), y, Math.cos(th) * sp, up, Math.sin(th) * sp, rnd(o.life[0], o.life[1]), rnd(o.size[0], o.size[1]), o.grow || 0, col, o.a ?? 1, o.shape || 0, o.grav ?? 4);
    }
  };

  const EMIT = {
    boom_small(x, y, o) { const c = rgb(o.color) || [1, .6, .2]; burst(x, y, 24, { sp: [.5, 2.2], up: [.3, 1.6], life: [.4, .8], size: [.1, .25], col: c, grav: 2 }); put(x, .2, y, 0, 0, 0, .35, .6, 2.5, [1, .9, .6], 1, 0, 0); },
    boom_big(x, y, o) { const c = rgb(o.color) || [1, .45, .12]; burst(x, y, 90, { sp: [1, 5.5], up: [.5, 3.5], life: [.6, 1.4], size: [.15, .45], grow: .1, col: c, grav: 3 }); burst(x, y, 40, { sp: [.5, 3], up: [0, 1], life: [.8, 1.8], size: [.3, .7], grow: .6, col: [.5, .2, .1], a: .5, grav: -.3 });
      put(x, .25, y, 0, 0, 0, .5, .8, 5, [1, .95, .8], 1, 0, 0); put(x, .1, y, 0, 0, 0, .8, .3, 7, [1, .6, .3], .9, 1, 0); },
    crumbs(x, y) { burst(x, y, 22, { sp: [.6, 3], up: [1, 3.5], life: [.7, 1.4], size: [.07, .15], cols: CRUMB, grav: 9 }); },
    spark(x, y, o) { const c = rgb(o.color) || [1, .95, .6]; burst(x, y, 12, { sp: [1.5, 4.5], up: [0, 1.5], life: [.15, .4], size: [.05, .12], col: c, grav: 6 }); },
    ring(x, y, o) { const c = rgb(o.color) || [.2, .9, 1]; put(x, .06, y, 0, 0, 0, .55, .2, ((o.radius ?? 60) * S * 6) / 0.55 / 3, c, 1, 1, 0); },
    thrust(x, y, o) { const a = o.angle ?? 0, bx = -Math.cos(a), by = -Math.sin(a);
      for (let k = 0; k < 3; k++) { const sp = rnd(1.5, 3.2), sx = rnd(-.4, .4), sy = rnd(-.4, .4); put(x + bx * .18, .22, y + by * .18, bx * sp + sx, 0, by * sp + sy, rnd(.18, .4), rnd(.14, .24), -.15, k ? [1, .45, .1] : [.6, .85, 1], .9, 0, 0); } },
    trail(x, y, o) { const c = rgb(o.color) || [1, .8, .3]; put(x, .2, y, rnd(-.1, .1), 0, rnd(-.1, .1), rnd(.25, .5), rnd(.1, .18), -.1, c, .7, 0, 0); },
    launch(x, y, o) { burst(x, y, 30, { sp: [1, 4], up: [.2, 1.2], life: [.3, .7], size: [.08, .2], col: rgb(o.color) || [1, .9, .5], grav: 1 }); put(x, .15, y, 0, 0, 0, .5, .2, 6, [1, 1, 1], .9, 1, 0); },
    confetti(x, y) { burst(x, y, 70, { sp: [.5, 3.5], up: [3, 7], life: [1.4, 2.6], size: [.1, .18], cols: CONF, grav: 5, shape: 2, a: .95 }); },
  };

  function emit(type, x, y, opts = {}) {
    const f = EMIT[type]; if (!f) return;
    const [wx, wy] = toWorld(x, y); f(wx, wy, opts || {});
  }
  const off = bus?.on?.('fx', p => p && emit(p.type, p.x, p.y, p.opts));

  return {
    points: pts, emit, types: FX_TYPES,
    setQuality(q) { const n = configFor(q).particles; if (n !== N) { geo.deleteAttribute?.('position'); alloc(n); head = 0; } },
    update(dt) {
      T += dt; mat.uniforms.uTime.value = T;
      if (dirty) { for (const k in A) geo.attributes[k].needsUpdate = true; dirty = false; }
    },
    setViewportHeight(px) { mat.uniforms.uScale.value = px * 0.9; },
    dispose() { off?.(); scene.remove(pts); geo.dispose(); mat.dispose(); },
  };
}
export const create = createFx;
