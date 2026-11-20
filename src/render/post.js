// Post chain: RenderPass -> GTAO -> Bloom -> Grade(vignette/CA/grain) -> OutputPass(ACES) -> SMAA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { configFor, normalizeQuality, createAutoQuality } from './quality.js';
import { getSettings } from '../core/settings.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.35 }, uCA: { value: 0.0016 }, uGrain: { value: 0.035 }, uSat: { value: 1.12 }, uContrast: { value: 1.06 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVignette,uCA,uGrain,uSat,uContrast; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv-.5; float r2 = dot(d,d);
      vec2 o = d * uCA * (1.+r2*4.);
      vec3 c = vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
      float l = dot(c, vec3(.2126,.7152,.0722));
      c = mix(vec3(l), c, uSat);
      c = (c-.18)*uContrast+.18; c = max(c, 0.);
      c *= 1. - uVignette*smoothstep(.15,.75,r2*1.9);
      c += (hash(vUv*vec2(1731.,1093.)+fract(uTime)*91.)-.5) * uGrain;
      gl_FragColor = vec4(max(c,0.),1.); }`,
};

export function createPost(renderer, scene, camera, quality = 'high', opts = {}) {
  let q = normalizeQuality(quality), cfg = configFor(q);
  let w = 1, h = 1, time = 0;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  w = size.x || 1; h = size.y || 1;
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio?.(1);
  composer.setSize(w, h);
  const renderPass = new RenderPass(scene, camera);
  let gtao = null;
  try { gtao = new GTAOPass(scene, camera, w, h); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 1; gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 }); } catch (e) { console.warn('[post] GTAO unavailable', e); }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.6, 0.85);
  const grade = new ShaderPass(GradeShader);
  const output = new OutputPass();
  let smaa = null;
  try { smaa = new SMAAPass(); } catch (e) { console.warn('[post] SMAA unavailable', e); }
  composer.addPass(renderPass);
  if (gtao) composer.addPass(gtao);
  composer.addPass(bloom); composer.addPass(grade); composer.addPass(output);
  if (smaa) composer.addPass(smaa);

  const auto = createAutoQuality({ quality: q, ...(opts.auto || {}), onDowngrade: nq => { api.setQuality(nq); opts.onDowngrade?.(nq); } });

  function applyQuality(nq) {
    q = normalizeQuality(nq); cfg = configFor(q); auto.setQuality(q);
    if (gtao) gtao.enabled = cfg.gtao;
    bloom.enabled = cfg.bloom;
    grade.enabled = cfg.grade;
    if (smaa) smaa.enabled = cfg.smaa;
    renderer.setPixelRatio(Math.min(cfg.pixelRatio, globalThis.devicePixelRatio || 1));
    if (w > 1) api.resize(w, h);
  }

  const api = {
    composer, passes: { renderPass, gtao, bloom, grade, output, smaa },
    get quality() { return q; }, get fps() { return auto.fps; },
    set autoQuality(v) { auto.enabled = v; },
    render(dt = 1 / 60) {
      time += dt; auto.tick(dt);
      if (!cfg.post) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.render(scene, camera); return; }
      grade.uniforms.uTime.value = time;
      bloom.strength = 0.55 * (getSettings().bloom ?? 1);
      composer.render(dt);
    },
    // w,h are CSS pixels or drawing-buffer size; we resolve to the renderer's current drawing buffer.
    resize(nw, nh) {
      if (nw && nh) { w = nw; h = nh; }
      const dpr = renderer.getPixelRatio();
      composer.setPixelRatio?.(dpr);
      composer.setSize(w, h);
      bloom.resolution.set(Math.max(1, (w * dpr * cfg.bloomScale) | 0), Math.max(1, (h * dpr * cfg.bloomScale) | 0));
      gtao?.setSize?.(w * dpr, h * dpr);
    },
    setQuality: applyQuality,
    dispose() { composer.dispose?.(); },
  };
  applyQuality(q);
  return api;
}
export const attach = createPost;
