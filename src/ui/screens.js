// Title / pause / game-over (with arcade initials + localStorage high-score table).
import { pad, esc } from './font.js';
import { DIFFICULTY_MENU, DIFFICULTY, DIFFICULTY_DEFAULT } from '../core/defs.js';
import { getSettings, setSettings } from '../core/settings.js';
const KEY = 'omega-ratrace-3d.scores';
export function loadScores() { try { const a = JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]'); return Array.isArray(a) ? a.slice(0, 10) : []; } catch { return []; } }
export function saveScore(name, score) {
  const a = loadScores(); a.push({ name: String(name || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A'), score: Math.floor(score) });
  a.sort((x, y) => y.score - x.score); const top = a.slice(0, 10);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(top)); } catch {}
  return top;
}
export const qualifies = score => score > 0 && (loadScores().length < 10 || score > loadScores().at(-1).score);
export const bestScore = () => loadScores()[0]?.score || 0;
const table = (rows, hl) => `<ol class="scores">${rows.map((r, i) => `<li${i === hl ? ' class="hl"' : ''}><span>${esc(r.name)}</span><span>${pad(r.score)}</span></li>`).join('') || '<li class="dim">no scores yet</li>'}</ol>`;

export function createScreens(root, { onStart, onResume, onOptions, onQuit, onSubmit } = {}) {
  const mk = (id, html) => { const d = document.createElement('div'); d.id = id; d.className = 'screen hidden'; d.innerHTML = html; root.appendChild(d); return d; };
  const title = mk('title', `<div class="neon-panel menu"><h1>OMEGA<br>RATRACE <span>3D</span></h1><p class="tag">Colby vs. the rats of the Omega arena</p>
    <div class="best" data-k="best"></div>
    <label class="diff">Difficulty <select data-k="diff">${DIFFICULTY_MENU.map(d => `<option value="${d}">${d} (${DIFFICULTY[d].hull} hits)</option>`).join('')}</select></label>
    <button class="neon-button" data-act="start">START</button><button class="neon-button alt" data-act="options">OPTIONS</button>
    <p class="help">Arrows/WASD rotate + thrust &middot; Space fire &middot; X yarn bomb &middot; P pause &middot; M mute</p></div>`);
  const pause = mk('pause', `<div class="neon-panel menu"><h2>PAUSED</h2><button class="neon-button" data-act="resume">RESUME</button>
    <button class="neon-button alt" data-act="options">OPTIONS</button><button class="neon-button alt" data-act="quit">QUIT TO TITLE</button></div>`);
  const over = mk('gameover', `<div class="neon-panel menu"><h2>GAME OVER</h2><div class="final" data-k="final"></div>
    <form data-k="entry" class="entry hidden" autocomplete="off"><label>NEW HIGH SCORE &mdash; INITIALS
    <input name="ini" maxlength="3" size="3" pattern="[A-Za-z0-9]{1,3}" autocapitalize="characters" spellcheck="false"></label>
    <button class="neon-button" type="submit">SAVE</button></form>
    <div data-k="table"></div><button class="neon-button" data-act="again">PLAY AGAIN</button><button class="neon-button alt" data-act="quit">TITLE</button></div>`);
  const dsel = title.querySelector('[data-k=diff]');
  dsel.addEventListener('change', () => setSettings({ difficulty: dsel.value }));
  const all = [title, pause, over]; let lastScore = 0;
  const hideAll = () => all.forEach(s => s.classList.add('hidden'));
  const acts = { start: () => onStart?.(), again: () => onStart?.(), resume: () => onResume?.(), options: () => onOptions?.(), quit: () => onQuit?.() };
  root.addEventListener('click', e => { const a = e.target.closest?.('[data-act]')?.dataset.act; if (a && acts[a] && all.some(s => s.contains(e.target))) acts[a](); });
  over.querySelector('form').addEventListener('submit', e => {
    e.preventDefault(); const name = e.target.ini.value || 'AAA'; const rows = saveScore(name, lastScore);
    e.target.classList.add('hidden'); over.querySelector('[data-k=table]').innerHTML = table(rows, rows.findIndex(r => r.score === lastScore));
    onSubmit?.(name, lastScore);
  });
  return {
    showTitle() { hideAll(); title.querySelector('[data-k=best]').textContent = bestScore() ? 'BEST ' + pad(bestScore()) : ''; { const d = getSettings().difficulty; dsel.value = DIFFICULTY_MENU.includes(d) ? d : DIFFICULTY_DEFAULT; } title.classList.remove('hidden'); title.querySelector('[data-act=start]').focus(); },
    showPause() { hideAll(); pause.classList.remove('hidden'); pause.querySelector('[data-act=resume]').focus(); },
    showGameOver(score) {
      hideAll(); lastScore = score; over.querySelector('[data-k=final]').textContent = 'SCORE ' + pad(score);
      const f = over.querySelector('form'); const q = qualifies(score); f.classList.toggle('hidden', !q); f.reset();
      over.querySelector('[data-k=table]').innerHTML = table(loadScores(), -1); over.classList.remove('hidden');
      (q ? f.ini : over.querySelector('[data-act=again]')).focus();
    },
    hide: hideAll, titleVisible: () => !title.classList.contains('hidden'), pauseVisible: () => !pause.classList.contains('hidden'),
    overVisible: () => !over.classList.contains('hidden'),
  };
}
