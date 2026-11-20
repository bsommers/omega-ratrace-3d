// DOM/CSS HUD driven by bus events + polled game state. Pure DOM; no three.js.
import { pad, esc } from './font.js';
export function createHud(root, bus) {
  const el = document.createElement('div'); el.id = 'hud'; el.className = 'hud hidden';
  el.innerHTML = `
    <div class="hud-top">
      <div class="hud-cell"><span class="lbl">SCORE</span><span class="val" data-k="score">000000</span></div>
      <div class="hud-cell hud-mid"><span class="lbl">WAVE</span><span class="val" data-k="wave">1</span><span class="wname" data-k="wname"></span></div>
      <div class="hud-cell hud-right"><span class="lbl">HI</span><span class="val" data-k="hi">000000</span></div>
    </div>
    <div class="hud-bottom">
      <div class="lifehull"><div class="lives" data-k="lives" aria-label="lives"></div>
      <div class="hull" data-k="hull" aria-label="hull"></div></div>
      <div class="combo hidden" data-k="combo"></div>
      <div class="bombs" data-k="bombs" aria-label="bombs"></div>
    </div>
    <div class="taunt hidden" data-k="taunt"></div>
    <div class="banner hidden" data-k="banner"><div class="b-text"></div><div class="b-sub"></div></div>
    <div class="popups" data-k="popups"></div>
    <div class="dbg hidden" data-k="dbg"></div>`;
  root.appendChild(el);
  const q = k => el.querySelector(`[data-k="${k}"]`);
  const E = { score: q('score'), wave: q('wave'), wname: q('wname'), hi: q('hi'), lives: q('lives'), hull: q('hull'), bombs: q('bombs'), combo: q('combo'),
    taunt: q('taunt'), banner: q('banner'), popups: q('popups'), dbg: q('dbg') };
  const cache = {}; let tauntT, bannerT;
  const set = (k, v, fn) => { if (cache[k] !== v) { cache[k] = v; fn(v); } };
  const cat = '<svg viewBox="0 0 24 24" class="cat"><path d="M3 3l5 4h8l5-4v9a9 9 0 0 1-18 0z" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="#05030f"/><circle cx="15" cy="12" r="1.3" fill="#05030f"/><path d="M11 15h2l-1 1.2z" fill="#05030f"/></svg>';
  const tuna = '<svg viewBox="0 0 24 24" class="tuna"><ellipse cx="11" cy="12" rx="8" ry="5" fill="currentColor"/><path d="M18 12l5-4v8z" fill="currentColor"/><circle cx="7" cy="11" r="1" fill="#05030f"/></svg>';
  const fit = (n, svg) => svg.repeat(Math.max(0, Math.min(n, 9)));
  const show = (node, text, ms, key) => { node.textContent = text; node.classList.remove('hidden'); node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop');
    clearTimeout(key === 't' ? tauntT : bannerT); const h = setTimeout(() => node.classList.add('hidden'), ms); if (key === 't') tauntT = h; else bannerT = h; };
  const offs = [
    bus.on('taunt', p => show(E.taunt, p?.text ?? '', 2600, 't')),
    bus.on('banner', p => { const b = E.banner; b.querySelector('.b-text').textContent = p?.text ?? ''; b.querySelector('.b-sub').textContent = p?.sub ?? '';
      b.classList.remove('hidden', 'pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.add('hidden'), (p?.dur ?? 2) * 1000); }),
    bus.on('wave', p => { if (p?.name) E.wname.textContent = p.name; }),
    bus.on('popup', p => { // popups in screen space: map sim coords proportionally to the HUD box
      const s = document.createElement('div'); s.className = 'popup'; s.textContent = p?.text ?? '';
      s.style.left = (p?.x ?? 400) / 800 * 100 + '%'; s.style.top = (p?.y ?? 225) / 450 * 100 + '%'; if (p?.color) s.style.color = p.color;
      E.popups.appendChild(s); setTimeout(() => s.remove(), 1100); }),
  ];
  return {
    el, show() { el.classList.remove('hidden'); }, hide() { el.classList.add('hidden'); },
    update(g, dbg) {
      set('score', g.score, v => E.score.textContent = pad(v));
      set('hi', Math.max(g.hiscore, g.score), v => E.hi.textContent = pad(v));
      set('wave', g.wave, v => E.wave.textContent = v);
      set('lives', g.lives, v => E.lives.innerHTML = fit(v, cat));
      { const hp = g.ship?.hull ?? 0, hm = g.ship?.hullMax ?? 0, key = hp + '/' + hm;
        set('hull', key, () => { const f = hm ? hp / hm : 0; E.hull.dataset.lvl = f > 0.6 ? 'ok' : f > 0.3 ? 'warn' : 'crit';
          E.hull.innerHTML = Array.from({ length: hm }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join(''); E.hull.setAttribute('aria-label', `hull ${hp} of ${hm}`); }); }
      set('bombs', g.bombs, v => E.bombs.innerHTML = fit(v, tuna));
      set('combo', g.combo, v => { E.combo.textContent = v > 1 ? 'x' + v : ''; E.combo.classList.toggle('hidden', !(v > 1)); });
      if (dbg) { E.dbg.classList.remove('hidden'); E.dbg.textContent = dbg; }
    },
    dispose() { offs.forEach(f => f()); el.remove(); },
  };
}
