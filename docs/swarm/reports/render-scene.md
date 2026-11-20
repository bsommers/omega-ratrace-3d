# render-scene report
## What I built
src/render/{camera,scene,arena,entities,renderer}.js: tilted 55deg camera (drift, ship parallax, trauma shake via bus `shake`), GLB library with primitive fallbacks for every MODELS entry, procedural arena (cheese canvas texture floor, neon rail walls, Mouse Hole box; swaps in arena.glb/mousehole.glb if loaded), id-pooled entity meshes (Colby bank + `Flame` scaled by thrust + invuln blink, mine spin, Death Rat pulse, tuna bob), guarded dynamic import of lighting/post/fx with fallback light + plain render.
## Verification evidence
`node --test test/render-scene.test.mjs` 6/6 pass. Headless screenshot of out/scene-test.html (out/shots/scene.png) with real post/lighting/fx: no errors, arena + entities visible, post modules attached.
## Deviations
GLB nose axis: ARCHITECTURE says +X, defs.js comment says -Z; normalize() auto-rotates if model is longer in Z. Shadow type PCFShadowMap (PCFSoft removed in vendored three). Floor/neon intensities lowered to avoid bloom washout.
## Mistakes and fixes
GLB base path was page-relative (404s from /out/); now resolved from import.meta.url. Floor was blown out under render-post bloom; darkened.
## Learnings
Vendored three warns PCFSoftShadowMap removed.
## Requests
render-post lighting.js still uses PCFSoftShadowMap (console warning). Missing GLBs: mouse, rat, commander, deathrat, mousehole, arena, hairball ok; fallbacks used. src/main.js absent so no full-game shot yet.
