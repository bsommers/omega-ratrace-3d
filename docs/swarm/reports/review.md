# review report
Stamped: 2026-11-20 UTC

## What I built
README.md, docs/HOW-TO-PLAY.md, docs/ARCH-OVERVIEW.md, docs/LEARNINGS.md, test/review.test.mjs.

## Verification evidence
npm test: 51 pass (before adding review.test.mjs); review.test.mjs 3 pass (README links/images resolve, numbers match defs). check-imports: 30 files, 0 errors. Controls, URL params, quality tiers read from input.js, main.js, quality.js, defs.js.

## Deviations
No fresh screenshots viewed; README table uses existing docs/screenshots files.

## Mistakes and fixes
None notable.

## Learnings
See docs/LEARNINGS.md.

## Unfixed findings (not my files)
1. ARCHITECTURE.md says tilt ~55 deg; code is 67 (camera.js); docs/INTEGRATION-NOTES.md says 62. Both stale.
2. docs/BUILD.md says STLs ~68 MB; assets/print is 62 MB. BUILD.md gallery names `shot-*.png` while screenshots live in docs/screenshots.
3. docs/INTEGRATION-NOTES.md "Verified: npm test 46 pass" stale (now 51+).
4. Integrate report open item: bot loses ~3 lives in 5 waves; qa-bot flags wave clear 30-40 s vs 42 s Death Rat timer.
5. render-post lighting.js PCFSoftShadowMap warning (render-scene request) not re-verified.
6. ui-shell: gamepad, touch, options UI not verified by its author (integrate verified some in browser).
7. docs/swarm/progress/ has no files for several agents (cosmetic).

## Requests
- site owner: add link to https://github.com/bsommers/omega-ratrace-3d in docs/site/index.html (I do not own it; currently no repo link).
- orchestrator: create the GitHub repo bsommers/omega-ratrace-3d, set Pages source to GitHub Actions, commit.
- ARCHITECTURE.md owner: update tilt to 67 deg.
