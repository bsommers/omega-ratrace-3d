// Canonical constants for OMEGA RATRACE 3D. FROZEN: owned by the orchestrator. See ARCHITECTURE.md.
// Gameplay numbers are COMPATIBLE with (not imported from) the 2D repo. Sim works in logical units on the x/y plane.
export const W = 800, H = 450;
export const BOX = Object.freeze({ x0: 190, y0: 130, x1: 610, y1: 320 }); // central Mouse Hole box
export const TICK = 1 / 60;
export const WORLD_SCALE = 0.02; // logical unit -> metre. Render: sim (x,y) -> three (x*S, 0, y*S), +Y up.

export const PALETTE = Object.freeze({
  bg: '#05030f', wall: '#7df9ff', wallHot: '#ff4fd8', cheese: '#ffc933', orange: '#ff8a1f', cream: '#fff3cf',
  colby: '#ff9b2e', colbyWhite: '#fff6e0', mouse: '#a8b0d8', rat: '#c27bff', cmd: '#ff5470', mine: '#ffe14d', death: '#ff2d55',
  hairball: '#fff6a8', ebullet: '#ff5fa2', text: '#fff3cf', dim: '#7a7aa8',
});

export const TUNING = Object.freeze({
  ship: { r: 11, rotSpeed: 4.6, aimRate: 7, thrust: 260, maxSpeed: 330, drag: 0.12, bounce: 0.88, fireCooldown: 0.16, maxShots: 4,
          invulnAfterDeath: 2.5, dyingTime: 1.4, bombs: 1 },
  shot: { speed: 520, life: 1.5, r: 3, ricochets: 1 },
  ebullet: { speed: 210, life: 3.2, r: 4 },
  lives: 3, extraLifeAt: [10000, 30000], extraLifeEvery: 30000,
  waveClearDelay: 2.2, introTime: 2.0, bombRadius: 170, deathRatAfter: 42,
  restitution: { mouse: 1, rat: 0.9, commander: 0.9, mine: 0.6, deathrat: 1 },
});

// 3D-only deviation from the 2D game (TUNING default there = 1 hit). `classic` = 2D-compatible, hidden from the menu.
export const DIFFICULTY = Object.freeze({
  hard: Object.freeze({ hull: 4 }), normal: Object.freeze({ hull: 6 }), easy: Object.freeze({ hull: 8 }), kitten: Object.freeze({ hull: 13 }),
  classic: Object.freeze({ hull: 1, hidden: true }),
});
export const DIFFICULTY_DEFAULT = 'normal';
export const DIFFICULTY_MENU = Object.freeze(['hard', 'normal', 'easy', 'kitten']);
export const HIT_INVULN = 1.0;

export const KINDS = Object.freeze({
  mouse:     { r: 10, hp: 1,  score: 100, speed: 90,  desc: 'Droid mouse: straight lines, bounces off walls' },
  rat:       { r: 12, hp: 2,  score: 250, speed: 140, desc: 'Chaser rat: homes on Colby' },
  commander: { r: 15, hp: 3,  score: 500, speed: 70,  desc: 'Commander rat: slow, fires cheese-pellet bursts, drops tuna' },
  mine:      { r: 9,  hp: 1,  score: 150, speed: 30,  desc: 'Cheese mine: drifts, bursts into 6 crumbs' },
  deathrat:  { r: 18, hp: 99, score: 0,   speed: 175, desc: 'Death Rat: unkillable hunter after deathRatAfter s' },
  tuna:      { r: 9,  hp: 1,  score: 500, speed: 0,   desc: 'Pickup: +500, +1 yarn bomb (max 3), expires 8 s' },
  hairball:  { r: 3,  hp: 1,  score: 0,   speed: 520, desc: 'Player shot' },
  ebullet:   { r: 4,  hp: 1,  score: 0,   speed: 210, desc: 'Enemy cheese pellet' },
});

// Blender-authored models, assets/models/<name>.glb (Y-up, metres, origin at centre, nose along +X, see ARCHITECTURE §6-7).
export const MODELS = Object.freeze(['colby', 'mouse', 'rat', 'commander', 'deathrat', 'mine', 'tuna', 'yarn', 'hairball', 'mousehole', 'arena']);
export const SFX = Object.freeze(['thrust', 'fire', 'bounce', 'hit', 'boom_small', 'boom_big', 'mine_burst', 'ebullet', 'pickup', 'bomb', 'death',
  'wave_start', 'wave_clear', 'extralife', 'deathrat_warn', 'menu_move', 'menu_select', 'gameover', 'hiscore', 'launch']);
export const MUSIC = Object.freeze(['title', 'wave_a', 'wave_b', 'gameover', 'hiscore']);
export const EVENTS = Object.freeze(['sfx', 'music', 'fx', 'shake', 'flash', 'hitstop', 'popup', 'wave', 'banner', 'score', 'life', 'bombs',
  'combo', 'gameover', 'pause', 'taunt', 'hull']);
export const FX_TYPES = Object.freeze(['boom_small', 'boom_big', 'crumbs', 'spark', 'ring', 'thrust', 'trail', 'launch', 'confetti']);
export const QUALITY = Object.freeze(['low', 'medium', 'high', 'ultra']);
