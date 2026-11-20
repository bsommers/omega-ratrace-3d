# difficulty report
## What I built
Hull per life (defs DIFFICULTY hard3/normal5/easy8/kitten13, hidden classic=1; HIT_INVULN 1s), damageShip in game.js (knock-back, hit sfx, shake, flash, `hull` event, deathrat -2 leaving 1), refill on respawn, hash includes hull. Settings key `difficulty`, `?difficulty=` param, title + options selectors, HUD segmented hull pips (green/amber/red) beside lives, botplay `--difficulty (all)`, test/difficulty.test.mjs, docs (README, HOW-TO-PLAY, ARCHITECTURE §4).
## Verification evidence
npm test: 61 pass, 0 fail. botplay --difficulty all: deterministic at each level. Screenshot out/shots/difficulty.png shows pips.
## Deviations
Edited style.css (hull pips) and test/sim-core.test.mjs line 63 (now uses difficulty 'classic'); added `hull` to EVENTS. Non-fatal hit does not reset combo.
## Mistakes and fixes
First screenshot taken before load; used --wait-for.
## Learnings
Bot rarely gets hit (0-1 deaths at all levels, seed 1, 5 waves).
## Requests
Renderer could use ship.hitT (0.3s) for a hit flash; not required.
