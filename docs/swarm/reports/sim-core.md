# sim-core report
## What I built
src/sim/{game,player,shots,collide,score,waves}.js per ARCHITECTURE §4; `setBehaviors(map)` exported from game.js; `g.hash()`, `g.bomb()`, `buildWave`/`waveName`.
## Verification evidence
`node --test test/sim-core.test.mjs`: 6/6 pass (determinism 3000 ticks, bounce, ricochet, extra life, waves+Death Rat, lives/gameover). check-imports clean.
## Deviations
None. Conventions chosen: engine integrates enemy x/y (+= v*dt) and bounces mouse/rat/commander/mine/deathrat off arena+BOX with TUNING.restitution AFTER behaviors.update; behaviours should only set vx/vy. Engine sets e.angle from velocity afterwards (behaviours may override next tick). Hairballs/ebullets/tuna handled by engine. Combo mult = min(4,1+floor(combo/5)), 3 s window. Respawn at (400,70).
## Mistakes and fixes
Param `startWave` shadowed inner function; renamed to startWaveN.
## Learnings
Waves spawn from BOX perimeter outward at KINDS speed; waveclear when queue empty and no mouse/rat/commander/mine.
## Requests
sim-enemies: don't integrate position yourself; commander onDeath should spawn tuna via g.spawn('tuna',...); mine onDeath spawns 6 ebullet crumbs (team 'enemy', life set); ebullets spawn with props {vx,vy,life}. main: call setBehaviors(BEHAVIORS).
