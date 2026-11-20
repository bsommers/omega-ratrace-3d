// Wave composition. buildWave(n, rng) -> [{kind, count, delay}] (delay = seconds between spawns).
const NAMES = ['Mouse Patrol', 'Rat Pack', 'Cheese Mines', 'Commander Rat', 'Rodent Rush', 'Whisker Storm', 'Sewer Siege', 'Omega Rodents'];
export function waveName(n) { return n <= NAMES.length ? NAMES[n - 1] : `${NAMES[(n - 1) % NAMES.length]} ${Math.floor((n - 1) / NAMES.length) + 1}`; }

export function buildWave(n, rng) {
  const out = [];
  const j = () => (rng ? rng.int(0, 1) : 0);
  out.push({ kind: 'mouse', count: Math.min(3 + n, 14) + j(), delay: Math.max(0.25, 0.6 - n * 0.03) });
  if (n >= 2) out.push({ kind: 'rat', count: Math.min(n - 1, 8) + (n >= 5 ? j() : 0), delay: Math.max(0.4, 0.9 - n * 0.04) });
  if (n >= 3) out.push({ kind: 'mine', count: Math.min(1 + Math.floor((n - 2) / 2), 6), delay: 0.8 });
  if (n >= 4) out.push({ kind: 'commander', count: Math.min(1 + Math.floor((n - 4) / 3), 4), delay: 1.5 });
  return out;
}
