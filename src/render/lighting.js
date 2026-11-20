// Lighting rig: procedural HDR environment (PMREM), key light w/ soft shadows, neon rim lights.
import * as THREE from 'three';
import { W, H, WORLD_SCALE as S } from '../core/defs.js';
import { configFor } from './quality.js';

const AW = W * S, AH = H * S; // 16 x 9 m
const NEON = [0xff2bd6, 0x19e6ff, 0xffb02e, 0x7a5cff];

// Gradient dome + glowing neon strips + soft box lights, baked to PMREM. No downloads.
function makeEnvScene() {
  const sc = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = vP.y*.5+.5;
      vec3 low = vec3(.02,.01,.05), mid = vec3(.07,.05,.16), top = vec3(.30,.34,.50);
      vec3 c = mix(low, mid, smoothstep(0.,.5,h)); c = mix(c, top, smoothstep(.5,1.,h));
      c += vec3(.5,.1,.45) * pow(max(0.,vP.x),6.) * .6 + vec3(.1,.5,.7) * pow(max(0.,-vP.x),6.) * .6;
      gl_FragColor = vec4(c,1.); }`,
  }));
  sc.add(dome);
  const emissive = (col, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i) });
  const strip = (col, i, w, h, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), emissive(col, i)); m.material.side = THREE.DoubleSide;
    m.position.set(...pos); m.lookAt(...(look || [0, 0, 0])); sc.add(m);
  };
  strip(0xfff1dc, 12, 30, 12, [-10, 40, 15]);          // warm softbox overhead (key)
  strip(0xff2bd6, 8, 40, 1.5, [-45, 8, 0]);            // magenta strip
  strip(0x19e6ff, 8, 40, 1.5, [45, 8, 0]);             // cyan strip
  strip(0xffb02e, 5, 30, 1, [0, 6, -45]);              // amber back strip
  strip(0x7a5cff, 4, 30, 1, [0, 6, 45]);               // violet front strip
  return sc;
}

export function build(scene, renderer, { quality = 'high' } = {}) {
  let cfg = configFor(quality);
  const group = new THREE.Group(); group.name = 'lighting'; scene.add(group);

  // Environment
  let envRT = null;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    envRT = pm.fromScene(makeEnvScene(), 0.02);
    pm.dispose();
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.8;
  } catch (e) { console.warn('[lighting] PMREM failed', e); }
  if (!scene.background) scene.background = new THREE.Color(0x05030c);

  // Key light (warm, soft PCF shadow) from upper-left-front
  const key = new THREE.DirectionalLight(0xfff0dd, 1.7);
  key.position.set(-5, 11, 4); key.target.position.set(0, 0, 0);
  key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -AW / 2 - 1; sc.right = AW / 2 + 1; sc.top = AH / 2 + 1; sc.bottom = -AH / 2 - 1; sc.near = 1; sc.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.blurSamples = 12;
  group.add(key, key.target);
  const fill = new THREE.HemisphereLight(0x6a7cff, 0x1a0b24, 0.35); group.add(fill);

  // Neon rim lights around the arena perimeter, low and coloured
  const rims = [];
  const P = [[-AW / 2, -AH / 2], [AW / 2, -AH / 2], [AW / 2, AH / 2], [-AW / 2, AH / 2], [0, -AH / 2], [0, AH / 2], [-AW / 2, 0], [AW / 2, 0]];
  P.forEach((p, i) => {
    const l = new THREE.PointLight(NEON[i % NEON.length], 7, 8, 2);
    l.position.set(p[0] * 0.95, 0.9, p[1] * 0.95); l.userData.base = l.intensity; l.userData.i = i;
    group.add(l); rims.push(l);
  });

  function applyQuality(q) {
    cfg = configFor(q);
    renderer.shadowMap.enabled = cfg.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = cfg.shadows;
    if (key.shadow.mapSize.x !== cfg.shadowMap) {
      key.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap);
      key.shadow.map?.dispose(); key.shadow.map = null;
    }
    rims.forEach((l, i) => { l.visible = i < cfg.rimLights; });
    // shadow-receiving materials must recompile when shadows toggle
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  applyQuality(quality);

  return {
    key, rims, group, envTexture: envRT?.texture ?? null,
    setQuality: applyQuality,
    update(t) {
      rims.forEach(l => { l.intensity = l.userData.base * (0.85 + 0.15 * Math.sin(t * 1.7 + l.userData.i * 1.3)); });
    },
    dispose() { scene.remove(group); envRT?.dispose(); if (scene.environment === envRT?.texture) scene.environment = null; },
  };
}
export const createLighting = build;
