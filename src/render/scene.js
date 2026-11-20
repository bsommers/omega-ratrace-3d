// Scene graph, GLB loading with primitive fallbacks, basic fallback light rig.
import * as THREE from 'three';
import { KINDS, PALETTE, WORLD_SCALE as S, MODELS } from '../core/defs.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.Fog(PALETTE.bg, 28, 60);
  const world = new THREE.Group(); world.name = 'world';
  scene.add(world);
  return { scene, world };
}

/** Basic lighting used until render-post's lighting.build() exists. Returns {update(t), lights}. */
export function buildFallbackLights(scene) {
  const g = new THREE.Group(); g.name = 'fallback-lights';
  g.add(new THREE.HemisphereLight(0x8fa8ff, 0x1a0f2e, 0.9));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(-4, 12, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const c = key.shadow.camera; c.left = -10; c.right = 10; c.top = 6; c.bottom = -6; c.near = 1; c.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  g.add(key);
  const rimA = new THREE.PointLight(0x7df9ff, 30, 25); rimA.position.set(-8, 2, 0); g.add(rimA);
  const rimB = new THREE.PointLight(0xff4fd8, 30, 25); rimB.position.set(8, 2, 0); g.add(rimB);
  scene.add(g);
  return { lights: g, update() {} };
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...o });
const glow = (color, k = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });
function mesh(geo, m, cast = true) { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = true; return o; }
const xAxis = (geo) => geo.rotateZ(-Math.PI / 2); // cone/cylinder tip (+Y) -> +X

/** Procedural stand-in, nose along +X, authored at in-game size (half-extent ~ r*S). */
export function makeFallback(name) {
  const k = KINDS[name] || KINDS[{ colby: 'mouse', yarn: 'tuna', mousehole: 'mine' }[name]] || { r: 10 };
  const R = k.r * S; // metres
  const g = new THREE.Group(); g.name = 'fallback_' + name;
  if (name === 'colby') {
    const body = mesh(xAxis(new THREE.ConeGeometry(R * 0.8, R * 2, 5, 1)), mat(PALETTE.colby, { roughness: 0.55 }));
    body.scale.set(1, 1, 1.15);
    const belly = mesh(new THREE.SphereGeometry(R * 0.55, 16, 12), mat(PALETTE.colbyWhite, { roughness: 0.7 }));
    belly.position.set(-R * 0.15, R * 0.12, 0); belly.scale.set(1.2, 0.8, 1);
    const visor = mesh(new THREE.SphereGeometry(R * 0.3, 12, 8), glow(0x7df9ff, 1.5)); visor.position.set(R * 0.45, R * 0.3, 0); visor.scale.set(1.2, 0.5, 1.4);
    for (const z of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(R * 0.2, R * 0.4, 4), mat(PALETTE.orange)); ear.position.set(R * 0.2, R * 0.65, z * R * 0.35); g.add(ear); }
    g.add(body, belly, visor);
    const flame = new THREE.Group(); flame.name = 'Flame';
    const fc = mesh(xAxis(new THREE.ConeGeometry(R * 0.35, R * 1.4, 10)).rotateZ(Math.PI), glow(0xff9b2e, 3), false); fc.position.x = -R * 0.8 - R * 0.7; // tip points -X
    const fi = mesh(xAxis(new THREE.ConeGeometry(R * 0.18, R * 0.9, 8)).rotateZ(Math.PI), glow(0xfff6a8, 4), false); fi.position.x = -R * 0.8 - R * 0.45;
    flame.add(fc, fi); g.add(flame);
  } else if (name === 'mouse' || name === 'rat' || name === 'commander' || name === 'deathrat') {
    const col = { mouse: PALETTE.mouse, rat: PALETTE.rat, commander: PALETTE.cmd, deathrat: 0x111118 }[name];
    const body = mesh(new THREE.SphereGeometry(R * 0.8, 16, 12), mat(col, { roughness: 0.75 })); body.scale.set(1.25, 0.8, 0.85);
    const snout = mesh(xAxis(new THREE.ConeGeometry(R * 0.35, R * 0.6, 8)), mat(col, { roughness: 0.7 })); snout.position.x = R * 1.0;
    const eyeM = name === 'deathrat' ? glow(PALETTE.death, 3) : mat(0x050505, { roughness: 0.1, metalness: 0.4 });
    for (const z of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(R * 0.28, 10, 8), mat(0xffa0b8)); ear.scale.set(0.5, 1, 1); ear.position.set(R * 0.35, R * 0.5, z * R * 0.5); g.add(ear);
      const eye = mesh(new THREE.SphereGeometry(R * 0.1, 8, 6), eyeM, false); eye.position.set(R * 0.75, R * 0.28, z * R * 0.25); g.add(eye);
    }
    const tail = mesh(xAxis(new THREE.CylinderGeometry(R * 0.04, R * 0.07, R * 1.3, 6)), mat(0xffa0b8)); tail.position.x = -R * 1.5;
    g.add(body, snout, tail);
    if (name === 'commander') { const b = mesh(new THREE.ConeGeometry(R * 0.2, R * 0.3, 3), mat(PALETTE.cheese)); b.position.set(0, R * 0.7, 0); g.add(b); }
  } else if (name === 'mine') {
    const core = mesh(new THREE.IcosahedronGeometry(R, 1), mat(PALETTE.cheese, { roughness: 0.35 }));
    g.add(core);
    for (let i = 0; i < 6; i++) { const s = mesh(new THREE.ConeGeometry(R * 0.16, R * 0.5, 5), glow(PALETTE.mine, 1.2)); const d = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]][i];
      s.position.set(d[0] * R, d[1] * R, d[2] * R); s.lookAt(d[0] * 9, d[1] * 9, d[2] * 9); s.rotateX(Math.PI / 2); g.add(s); }
  } else if (name === 'tuna') {
    const can = mesh(new THREE.CylinderGeometry(R * 0.9, R * 0.9, R * 0.8, 20), mat(0xb7c2d6, { metalness: 0.9, roughness: 0.25 }));
    const lbl = mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.92, R * 0.4, 20), mat(0x2f7dff)); g.add(can, lbl);
  } else if (name === 'yarn') {
    g.add(mesh(new THREE.SphereGeometry(R, 20, 14), mat(PALETTE.wallHot, { roughness: 0.9 })));
  } else if (name === 'hairball' || name === 'ebullet') {
    const c = name === 'ebullet' ? PALETTE.ebullet : PALETTE.hairball;
    const m = mesh(new THREE.SphereGeometry(Math.max(R, 0.07), 12, 10), glow(c, 2.5), false); g.add(m);
  } else {
    g.add(mesh(new THREE.SphereGeometry(R, 12, 10), mat(0xffffff)));
  }
  return g;
}

/** Normalize a loaded GLB scene: nose to +X (heuristic), size to r. */
function normalize(root, name) {
  const box = new THREE.Box3().setFromObject(root); const sz = box.getSize(new THREE.Vector3());
  const wrap = new THREE.Group(); wrap.name = name; wrap.add(root);
  if (sz.z > sz.x * 1.25) root.rotation.y = -Math.PI / 2; // authored nose along -Z (defs.js comment) -> +X
  const k = KINDS[name]; const b2 = new THREE.Box3().setFromObject(wrap); const s2 = b2.getSize(new THREE.Vector3());
  if (k) { const want = k.r * S * 2, have = Math.max(s2.x, s2.z, 1e-6); if (have / want > 2 || have / want < 0.5) wrap.scale.multiplyScalar(want / have); }
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return wrap;
}

/** Loader: load(name) -> Promise<Object3D template>, never rejects (falls back to primitives). */
export function createModelLibrary({ base = new URL('../../assets/models/', import.meta.url).href } = {}) {
  const templates = new Map(); const status = {}; let loader = null;
  async function getLoader() {
    if (loader !== null) return loader;
    try { const m = await import('three/addons/loaders/GLTFLoader.js'); loader = new m.GLTFLoader(); } catch { loader = false; }
    return loader;
  }
  async function load(name) {
    if (templates.has(name)) return templates.get(name);
    let tpl = null;
    try {
      const l = await getLoader();
      if (l && typeof fetch === 'function') {
        const gltf = await l.loadAsync(base + name + '.glb');
        tpl = normalize(gltf.scene, name); status[name] = 'glb';
      }
    } catch { /* missing/invalid -> fallback */ }
    if (!tpl) { tpl = makeFallback(name); status[name] = 'fallback'; }
    templates.set(name, tpl); return tpl;
  }
  const get = (name) => templates.get(name) || (templates.set(name, makeFallback(name)), status[name] ||= 'fallback', templates.get(name));
  const instance = (name) => { const t = get(name); const c = t.clone(true); c.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); } }); return c; };
  return { load, loadAll: () => Promise.all(MODELS.map(load)), get, instance, status };
}
