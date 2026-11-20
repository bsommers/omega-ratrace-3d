// Renderer facade (ARCHITECTURE §5): createRenderer(canvas,{bus,settings}) -> {load,draw,resize,setQuality,shot,dispose}
import * as THREE from 'three';
import { createScene, buildFallbackLights, createModelLibrary } from './scene.js';
import { createCamera } from './camera.js';
import { buildArena } from './arena.js';
import { createEntities } from './entities.js';

const settingsOf = (s) => (typeof s?.get === 'function' ? s.get() : typeof s === 'function' ? s() : s) || {};

export function createRenderer(canvas, { bus, settings, quality } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const { scene, world } = createScene();
  const cam = createCamera(1);
  const models = createModelLibrary();
  let entities = null, post = null, lighting = null, fx = null, q = quality || settingsOf(settings).quality || 'high';
  let t = 0, last = null, w = 0, h = 0, pixelRatio = 1;
  const offs = [];
  if (bus) offs.push(bus.on('shake', (p) => cam.shake(p?.mag, p?.dur)));

  const tryImport = async (p) => { try { return await import(p); } catch { return null; } };

  async function load() {
    await models.loadAll();
    world.add(buildArena({ models }));
    entities = createEntities(world, models);
    const [L, P, F] = await Promise.all([tryImport('./lighting.js'), tryImport('./post.js'), tryImport('./fx.js')]);
    try { lighting = L?.lighting?.build ? L.lighting.build(scene, renderer) : L?.build ? L.build(scene, renderer) : null; } catch (e) { console.warn('lighting failed', e); }
    if (!lighting) lighting = buildFallbackLights(scene);
    try { const cf = F?.createFx || F?.fx?.createFx; fx = cf ? cf(scene, bus) : null; } catch (e) { console.warn('fx failed', e); }
    try {
      const create = P?.createPost || P?.post?.createPost;
      post = create ? create(renderer, scene, cam.camera, q) : null;
    } catch (e) { console.warn('post failed', e); post = null; }
    resize(); setQuality(q);
    return { models: { ...models.status }, post: !!post, lighting: lighting && !lighting.lights ? 'post' : 'fallback', fx: !!fx };
  }

  function resize() {
    const r = canvas.getBoundingClientRect?.() || {};
    const cw = Math.max(1, Math.floor(r.width || canvas.clientWidth || canvas.width || 1280));
    const ch = Math.max(1, Math.floor(r.height || canvas.clientHeight || canvas.height || 720));
    w = cw; h = ch;
    renderer.setPixelRatio(pixelRatio); renderer.setSize(cw, ch, false);
    cam.resize(cw / ch); post?.resize?.(cw, ch); fx?.setViewportHeight?.(canvas.clientHeight || ch);
  }
  function setQuality(nq) {
    q = nq || q;
    pixelRatio = Math.min(globalThis.devicePixelRatio || 1, { low: 1, medium: 1.25, high: 1.5, ultra: 2 }[q] ?? 1.5);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.needsUpdate = true;
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    post?.setQuality?.(q); lighting?.setQuality?.(q); fx?.setQuality?.(q); if (w) resize();
  }
  function draw(g, alpha = 1, dt = 1 / 60) {
    t += dt;
    if (entities && g) entities.sync(g, alpha, dt, t);
    cam.update(dt, g, { shakeScale: settingsOf(settings).shake ?? 1 });
    lighting?.update?.(t); fx?.update?.(dt);
    if (post?.render) post.render(dt); else renderer.render(scene, cam.camera);
  }
  function shot() { if (post?.render) post.render(0); else renderer.render(scene, cam.camera); return canvas.toDataURL('image/png'); }
  function dispose() { offs.forEach(f => f?.()); renderer.dispose(); }
  return { load, draw, resize, setQuality, shot, dispose, scene, camera: cam.camera, three: renderer };
}
