// Sim entity <-> mesh sync, pooled by id. Colby banks/flames, mines spin, Death Rat pulses.
import * as THREE from 'three';
import { W, H, WORLD_SCALE as S, TICK } from '../core/defs.js';

const HOVER = { colby: 0.12, mouse: 0.0, rat: 0.0, commander: 0.0, deathrat: 0.0, mine: 0.2, tuna: 0.18, yarn: 0.2, hairball: 0.2, ebullet: 0.2 };
const MODEL_OF = { hairball: 'hairball', ebullet: 'hairball', mine: 'mine', tuna: 'tuna' };
const VIS = 2.5; // visual enlargement vs sim radius so ships/mice read at arena scale (integrate)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createEntities(parent, models) {
  const group = new THREE.Group(); group.name = 'entities'; parent.add(group);
  const live = new Map();           // id -> rec
  const free = new Map();           // modelName -> rec[]
  const st = { flame: 0, prevAngle: null, bank: 0 };
  const cname = (kind) => MODEL_OF[kind] || kind;

  function acquire(id, kind) {
    const name = cname(kind); const pool = free.get(name);
    let rec = pool?.pop();
    if (!rec) {
      const obj = models.instance(name);
      let flame = null; obj.traverse(o => { if (!flame && o.name === 'Flame') flame = o; });
      const mats = []; obj.traverse(o => { if (o.isMesh && o.material?.emissive) mats.push(o.material); });
      rec = { obj, name, flame, mats, base: mats.map(m => m.emissiveIntensity), baseScale: obj.scale.clone().multiplyScalar(VIS) };
      group.add(obj);
    }
    rec.id = id; rec.kind = kind; rec.obj.visible = true; rec.phase = (typeof id === 'number' ? id : 0) * 1.7;
    if (kind === 'ebullet') rec.obj.scale.copy(rec.baseScale).multiplyScalar(0.8);
    else rec.obj.scale.copy(rec.baseScale);
    live.set(id, rec); return rec;
  }
  function release(id) {
    const rec = live.get(id); if (!rec) return;
    rec.obj.visible = false; live.delete(id);
    (free.get(rec.name) || free.set(rec.name, []).get(rec.name)).push(rec);
  }
  function place(rec, e, alpha, t) {
    const a = clamp(alpha || 0, 0, 1) * TICK;
    const x = e.x + (e.vx || 0) * a, y = e.y + (e.vy || 0) * a;
    const hover = HOVER[rec.kind] ?? 0;
    rec.obj.position.set(x * S - W * S / 2, hover + (rec.kind === 'tuna' ? Math.sin(t * 3 + rec.phase) * 0.04 : 0), y * S - H * S / 2);
    rec.obj.rotation.set(0, -(e.angle ?? Math.atan2(e.vy || 0, e.vx || 0)), 0);
  }

  function sync(g, alpha, dt, t) {
    const seen = new Set();
    const touch = (id, kind, e, extra) => {
      seen.add(id); const rec = live.get(id) || acquire(id, kind);
      place(rec, e, alpha, t); extra?.(rec); return rec;
    };
    // Colby
    const s = g.ship;
    if (s && s.alive) {
      touch('ship', 'colby', s, (rec) => {
        const da = st.prevAngle == null ? 0 : Math.atan2(Math.sin(s.angle - st.prevAngle), Math.cos(s.angle - st.prevAngle));
        st.prevAngle = s.angle;
        const target = clamp(-da / Math.max(dt, 1e-3) * 0.08, -0.5, 0.5);
        st.bank += (target - st.bank) * Math.min(1, dt * 10);
        rec.obj.rotation.x = st.bank; // roll about nose axis (+X)
        st.flame += ((s.thrusting ? 1 : 0) - st.flame) * Math.min(1, dt * 14);
        if (rec.flame) {
          const f = st.flame * (0.85 + 0.15 * Math.sin(t * 60));
          rec.flame.visible = st.flame > 0.03; rec.flame.scale.set(Math.max(0.05, f * 1.2), 0.4 + f * 0.7, 0.4 + f * 0.7);
        }
        // invulnerability blink
        rec.obj.visible = !(s.invuln > 0 && Math.floor(t * 14) % 2 === 0);
      });
    } else st.prevAngle = null;
    for (const e of g.ents) {
      if (e.dead) continue;
      touch(e.id, e.kind, e, (rec) => {
        if (e.kind === 'mine') { rec.obj.rotation.y = t * 1.6 + rec.phase; rec.obj.rotation.x = t * 1.1 + rec.phase; }
        else if (e.kind === 'deathrat') {
          const p = 0.5 + 0.5 * Math.sin(t * 6); const k = 1 + p * 0.1; rec.obj.scale.copy(rec.baseScale).multiplyScalar(k);
          rec.mats.forEach((m, i) => { m.emissiveIntensity = (rec.base[i] || 0) * (1 + p * 1.5); });
        } else if (e.kind === 'tuna') rec.obj.rotation.y = t * 1.2 + rec.phase;
        else if (e.kind === 'hairball') { rec.obj.rotation.y = t * 8; }
      });
    }
    for (const id of [...live.keys()]) if (!seen.has(id)) release(id);
  }
  return { sync, group, live, free };
}
