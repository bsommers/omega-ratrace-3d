// Tiny event bus: emit(type, payload), on(type, fn) -> off().
export function createBus() {
  const m = new Map();
  return {
    on(t, f) { (m.get(t) || m.set(t, new Set()).get(t)).add(f); return () => m.get(t)?.delete(f); },
    emit(t, p) { const s = m.get(t); if (s) for (const f of [...s]) f(p); },
  };
}
