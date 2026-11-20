# sim-enemies report
## What I built
src/sim/enemies.js: BEHAVIORS (mouse, rat wall-aware homing via BOX-corner detour, commander aimed 3-shot bursts + tuna drop, mine arm 1.5s/proximity burst/6 crumbs, deathrat unkillable hunter, tuna 8s expiry). Behaviours only set vx/vy; engine integrates.
## Verification evidence
node test/sim-enemies.test.mjs passes (mock g, determinism check). Not run against real game.js.
## Deviations
None. Armed mine self-detonates via g.kill(e,{score:false}).
## Mistakes and fixes
Test mock lacked ebullet behaviour; mine test drifted out of range. Fixed.
## Learnings
Engine already handles tuna expiry; behaviour duplicates harmlessly.
## Requests
main: setBehaviors(BEHAVIORS).
