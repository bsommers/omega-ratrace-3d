// Options menu (quality, volumes, mute, shake). Panel DOM; persists via core/settings.
import { QUALITY, DIFFICULTY_MENU, DIFFICULTY_DEFAULT, DIFFICULTY } from '../core/defs.js';
import { getSettings, setSettings } from '../core/settings.js';
export function createOptions(root, { onChange, onClose } = {}) {
  const el = document.createElement('div'); el.className = 'screen options hidden';
  const s = getSettings();
  el.innerHTML = `<div class="neon-panel menu">
    <h2>OPTIONS</h2>
    <label>Quality <select data-o="quality">${QUALITY.map(q => `<option${q === s.quality ? ' selected' : ''}>${q}</option>`).join('')}</select></label>
    <label>Difficulty <select data-o="difficulty">${DIFFICULTY_MENU.map(d => `<option value="${d}"${d === (s.difficulty || DIFFICULTY_DEFAULT) ? ' selected' : ''}>${d} (${DIFFICULTY[d].hull} hits)</option>`).join('')}</select></label>
    <label>Master <input type="range" min="0" max="1" step="0.05" data-o="master" value="${s.master}"></label>
    <label>SFX <input type="range" min="0" max="1" step="0.05" data-o="sfx" value="${s.sfx}"></label>
    <label>Music <input type="range" min="0" max="1" step="0.05" data-o="music" value="${s.music}"></label>
    <label>Screen shake <input type="range" min="0" max="1" step="0.05" data-o="shake" value="${s.shake}"></label>
    <label>Muted <input type="checkbox" data-o="muted"${s.muted ? ' checked' : ''}></label>
    <button class="neon-button" data-act="close">BACK</button></div>`;
  root.appendChild(el);
  el.addEventListener('input', e => {
    const k = e.target.dataset.o; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value;
    setSettings({ [k]: v }); onChange?.(k, v, getSettings());
  });
  el.addEventListener('click', e => { if (e.target.dataset.act === 'close') api.close(); });
  const api = {
    el, get open() { return !el.classList.contains('hidden'); },
    show() { const s2 = getSettings(); el.querySelector('[data-o=muted]').checked = !!s2.muted; el.classList.remove('hidden'); el.querySelector('select')?.focus(); },
    close() { el.classList.add('hidden'); onClose?.(); },
    syncMute() { el.querySelector('[data-o=muted]').checked = !!getSettings().muted; },
  };
  return api;
}
