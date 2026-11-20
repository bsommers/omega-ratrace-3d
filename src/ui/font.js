// Font stack + tiny text helpers (no downloads; system fonts only).
export const FONT_DISPLAY = '"Orbitron", "Eurostile", "Bahnschrift", "DIN Alternate", system-ui, sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
export function applyFont(root = document.documentElement) {
  root.style.setProperty('--font-display', FONT_DISPLAY);
  root.style.setProperty('--font-mono', FONT_MONO);
}
export const pad = (n, w = 6) => String(Math.max(0, Math.floor(n || 0))).padStart(w, '0');
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
