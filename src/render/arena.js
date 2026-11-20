// Procedural Omega arena: glossy cheese floor, neon rail walls, central Mouse Hole box. Uses arena.glb/mousehole.glb if loaded.
import * as THREE from 'three';
import { W, H, BOX, PALETTE, WORLD_SCALE as S } from '../core/defs.js';

export const toWorld = (x, y) => [x * S - W * S / 2, y * S - H * S / 2];

function cheeseTexture() {
  const N = 1024;
  let rnd = 12345; const r = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = N; c.height = Math.round(N * H / W * 1.0) || 576;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, c.width, c.height); gr.addColorStop(0, '#ffcf45'); gr.addColorStop(1, '#f2a91c');
    x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 90; i++) { // holes
      const px = r() * c.width, py = r() * c.height, rad = 6 + r() * r() * 46;
      const g = x.createRadialGradient(px, py, rad * 0.2, px, py, rad);
      g.addColorStop(0, 'rgba(120,70,0,0.55)'); g.addColorStop(0.8, 'rgba(160,100,10,0.35)'); g.addColorStop(1, 'rgba(255,230,140,0.0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,240,170,0.35)'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, rad * 0.95, 0.6, 2.6); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const w = 64, h = 36, d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const hole = r() < 0.06; d.set(hole ? [150, 100, 20, 255] : [255, 200, 70, 255], i * 4); }
  const t = new THREE.DataTexture(d, w, h); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

const neon = (c, k = 2.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3 });

export function buildArena({ models } = {}) {
  const g = new THREE.Group(); g.name = 'arena';
  const aw = W * S, ah = H * S;
  // floor
  const tex = cheeseTexture();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah),
    new THREE.MeshPhysicalMaterial({ map: tex, color: 0x9a8c78, roughness: 0.3, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'floor'; g.add(floor);
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x07050f, roughness: 0.6, metalness: 0.4 }));
  surround.rotation.x = -Math.PI / 2; surround.position.y = -0.02; surround.receiveShadow = true; g.add(surround);
  // grid lines on the floor (subtle neon)
  const grid = new THREE.GridHelper(aw, 20, PALETTE.wall, PALETTE.wall); grid.scale.z = ah / aw; grid.position.y = 0.004;
  for (const m of [].concat(grid.material)) { m.transparent = true; m.opacity = 0.06; m.depthWrite = false; }
  g.add(grid);

  // outer rail walls (outside the [0,W]x[0,H] playfield)
  const wallH = 0.38, th = 0.3, walls = new THREE.Group(); walls.name = 'walls';
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x14102a, roughness: 0.25, metalness: 0.85 });
  const addWall = (cx, cz, sx, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, wallH, sz), wallMat); m.position.set(cx, wallH / 2, cz); m.castShadow = m.receiveShadow = true; walls.add(m);
    const long = sx > sz; // neon strip on the inner top edge
    const s = new THREE.Mesh(new THREE.BoxGeometry(long ? sx : 0.05, 0.05, long ? 0.05 : sz), neon(PALETTE.wall, 1.3));
    const inner = long ? (cz > 0 ? -1 : 1) * (th / 2 - 0.03) : 0, innerX = long ? 0 : (cx > 0 ? -1 : 1) * (th / 2 - 0.03);
    s.position.set(cx + innerX, wallH + 0.01, cz + inner); walls.add(s);
  };
  addWall(0, -ah / 2 - th / 2, aw + th * 2, th); addWall(0, ah / 2 + th / 2, aw + th * 2, th);
  addWall(-aw / 2 - th / 2, 0, th, ah); addWall(aw / 2 + th / 2, 0, th, ah);
  g.add(walls);

  // Mouse Hole box
  const [bx0, bz0] = toWorld(BOX.x0, BOX.y0), [bx1, bz1] = toWorld(BOX.x1, BOX.y1);
  const bw = bx1 - bx0, bd = bz1 - bz0, bh = 0.22;
  const box = new THREE.Group(); box.name = 'mousehole'; box.position.set((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), new THREE.MeshPhysicalMaterial({ color: 0xb09060, roughness: 0.4, clearcoat: 0.3, map: tex }));
  body.position.y = bh / 2; body.castShadow = body.receiveShadow = true; box.add(body);
  const trim = (w, d2, x, z) => { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d2), neon(PALETTE.wallHot, 1.2)); t.position.set(x, bh + 0.01, z); box.add(t); };
  trim(bw, 0.06, 0, bd / 2 - 0.03); trim(bw, 0.06, 0, -bd / 2 + 0.03); trim(0.06, bd, bw / 2 - 0.03, 0); trim(0.06, bd, -bw / 2 + 0.03, 0);
  // mouse-hole door arches on the front face
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050308 }));
  arch.position.set(0, 0.0, bd / 2 + 0.005); box.add(arch);
  g.add(box);

  // swap in authored models when available
  const upgrade = (name, parent, replace, place) => {
    if (!models || models.status?.[name] !== 'glb') return;
    const inst = models.instance(name); place?.(inst); parent.add(inst); replace.visible = false;
  };
  upgrade('arena', g, walls);
  upgrade('mousehole', g, body, (o) => { o.position.copy(box.position); o.scale.y = 0.3; /* 2.2 m GLB squashed: tall box hid the lane behind it */ });
  return g;
}
