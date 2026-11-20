// Unified input: keyboard, gamepad, touch -> { rot, thrust, fire, bomb(edge), pause?(edge) }. DOM-safe: Node import is harmless.
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], thrust: ['ArrowUp', 'KeyW'], fire: ['Space'], bomb: ['KeyX', 'KeyB'],
  pause: ['KeyP', 'Escape'], mute: ['KeyM'], confirm: ['Enter'],
};
export function createInput(target = globalThis.window, { touchRoot } = {}) {
  const down = new Set(); const edges = { bomb: false, pause: false, mute: false, confirm: false, any: false };
  const listeners = new Set(); const touch = { rot: 0, thrust: false, fire: false };
  const has = (act) => KEYMAP[act].some(c => down.has(c));
  const emit = (act) => { edges[act] = true; for (const f of listeners) f(act); };
  let padPrev = { bomb: false, pause: false };
  const api = {
    keys: down, touch,
    onAction(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // Sample current input; clears edge flags. gamepad polled here.
    poll() {
      let rot = (has('right') ? 1 : 0) - (has('left') ? 1 : 0) + touch.rot;
      let thrust = has('thrust') || touch.thrust ? 1 : 0, fire = has('fire') || touch.fire;
      let bomb = edges.bomb, pause = edges.pause;
      const gp = globalThis.navigator?.getGamepads?.()?.find(Boolean);
      if (gp) {
        const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.2) rot += ax;
        const b = i => !!gp.buttons[i]?.pressed;
        if (b(14)) rot -= 1; if (b(15)) rot += 1;
        if (b(0) || b(7) || b(5)) thrust = Math.max(thrust, b(7) ? gp.buttons[7].value : 1);
        if ((gp.axes[1] || 0) < -0.5 || b(12)) thrust = 1;
        if (b(2) || b(1) || b(6)) fire = true;
        const pb = b(3) || b(4), ps = b(9);
        if (pb && !padPrev.bomb) bomb = true; if (ps && !padPrev.pause) pause = true;
        padPrev = { bomb: pb, pause: ps };
        if (b(0) || b(9)) edges.any = true;
      }
      edges.bomb = edges.pause = false;
      return { rot: Math.max(-1, Math.min(1, rot)), thrust, fire, bomb, pause };
    },
    takeEdge(name) { const v = edges[name]; edges[name] = false; return v; },
    dispose() { for (const [t, f] of off) t.removeEventListener(...f); },
  };
  const off = [];
  const add = (t, ev, fn, o) => { t?.addEventListener?.(ev, fn, o); off.push([t, [ev, fn, o]]); };
  const codeAct = c => Object.keys(KEYMAP).find(a => KEYMAP[a].includes(c));
  add(target, 'keydown', e => {
    if (e.target?.tagName === 'INPUT' && e.code !== 'Enter' && e.code !== 'Escape') return;
    const act = codeAct(e.code); edges.any = true;
    if (act) { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }
    if (e.repeat) return;
    down.add(e.code);
    if (act === 'bomb' || act === 'pause' || act === 'mute' || act === 'confirm') emit(act);
  });
  add(target, 'keyup', e => down.delete(e.code));
  add(target, 'blur', () => { down.clear(); touch.rot = 0; touch.thrust = touch.fire = false; });
  // Touch: left half = steer pad (x offset from touch start), buttons FIRE / BOMB / THRUST on right.
  if (touchRoot) {
    const mk = (cls, label) => { const b = document.createElement('button'); b.className = 'tbtn ' + cls; b.textContent = label; b.type = 'button'; touchRoot.appendChild(b); return b; };
    const hold = (el, key) => {
      const set = v => { touch[key] = v; el.classList.toggle('on', v); };
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); set(true); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => set(false));
    };
    const l = mk('t-left', '◀'), r = mk('t-right', '▶'), th = mk('t-thrust', 'THRUST'), f = mk('t-fire', 'FIRE'), b = mk('t-bomb', 'BOMB');
    const dir = (el, v) => { el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); touch.rot = v; el.classList.add('on'); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => { if (touch.rot === v) touch.rot = 0; el.classList.remove('on'); }); };
    dir(l, -1); dir(r, 1); hold(th, 'thrust'); hold(f, 'fire');
    b.addEventListener('pointerdown', e => { e.preventDefault(); emit('bomb'); });
  }
  return api;
}
export const isTouchDevice = () => !!(globalThis.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in globalThis);
