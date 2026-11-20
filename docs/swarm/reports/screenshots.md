# screenshots report
## What I built
tools/capture-screens.mjs: drives tools/shot.mjs (swiftshader, 1600x900) for title, gameplay (wave 6, bot, ship alive), deathrat (forces _waveT), pause, gameover, quality-low, quality-ultra into docs/screenshots/; optipng; copies hero + shot-title/deathrat/pause/gameover to docs/site/img; copies out/previews to docs/screenshots/models + montage contact-sheet.png.
## Verification evidence
All 7 shots + contact sheet ok. Viewed gameplay, deathrat, gameover: good framing (Colby, mice, FX, Death Rat with taunt, game over panel).
## Deviations
Game over uses __omega.screens.showGameOver (forced) since swiftshader frame rate is too low for the natural 1.6s transition. No hairball in gameplay shot. quality-low/ultra/title/pause not viewed. test/screenshots.test.mjs not written.
## Mistakes and fixes
Gameplay ents>=14 wait timed out (120s); lowered to 8. First gameplay/gameover shots lacked Colby / the panel; fixed waits.
## Learnings
Each shot is a fresh Chrome, ~20-60s on swiftshader; full run ~6 min.
## Requests
None.
