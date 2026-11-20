# integrate report
## What I built
Wiring fixes (see docs/INTEGRATION-NOTES.md for each edit), test/integrate.test.mjs (4 tests).
## Verification evidence
npm test 46/46; check-imports 0 errors; botplay seeds 1-6 deterministic; shots out/shots/int-*.png at low/high/ultra, no console errors; 60.7 fps all tiers (headless Chrome, vsync-capped, so headroom unmeasured); game-over/initials, options, touch, gamepad verified via browser eval.
## Deviations
Did not build web tool (site, p4). Gamepad mapping only checked via polled synthetic pad.
## Mistakes and fixes
Ship was invisible: spawn lane hidden behind 2.2 m GLB box. Squashed box + steeper tilt.
## Learnings
main never called setBehaviors; mice stall fix lives in enemies.js. GLB sizes need checking against sim units.
## Requests
render-scene: bake box height into mousehole.glb rather than runtime scale. Bot: still loses ~3 lives in 5 waves.
