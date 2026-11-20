// Persistent settings (localStorage when present). get()/set(patch); Node-safe.
const KEY = 'omega-ratrace-3d.settings';
const DEFAULTS = { quality: 'high', master: 0.8, sfx: 1, music: 0.6, shake: 1, bloom: 1, muted: false, difficulty: 'normal' };
let cur = { ...DEFAULTS };
try { Object.assign(cur, JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}')); } catch {}
export const getSettings = () => cur;
export function setSettings(p) { cur = { ...cur, ...p }; try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cur)); } catch {} return cur; }
