# qa-bot report
## What I built
- `src/sim/autopilot.js`: `createAutopilot(opts).step(g) -> input`. Pure/deterministic. Intercept-aim at nearest enemy, closest-approach dodge (threat repulsion + sidestep), wall/box avoidance, ring-corner roaming when target is hidden behind the Mouse Hole box, tuna pickup, bomb when 2+ threats very close.
- `tools/botplay.mjs --waves N --seed S [--json] [--max-seconds T]`: runs twice, reports waves cleared/reached, deaths, score, hash, determinism, flags. Exports `playBot`.
- `test/qa-bot.test.mjs` (4 tests).
## Verification evidence
Seeds 1-8, waves 5: reached wave 5,5,4,4,5,5,6,6 (avg ~5); all runs deterministic (hash equal on rerun). Every run losing lives (3 deaths typical); not trivial.
## Deviations
None.
## Mistakes and fixes
First version camped at spawn; mice bouncing in the far lane behind the box were unkillable, waves stalled to Death Rat (42 s). Fixed with waypoint roaming.
## Learnings
Dodge radius 70 beat 95/130 (over-dodging stalls kills).
## Tuning flags
- Death Rat (42 s) still kills the bot in slow waves; Death Rat touch is unavoidable when ship caught (speed 175 vs ship 330).
- Wave 1 mice that bounce purely vertically in a lane behind the box need the player to relocate; consider spawn jitter making that rarer.
- Wave clear is 30-40 s per wave for the bot: close to the Death Rat timer.
## Requests
None.
