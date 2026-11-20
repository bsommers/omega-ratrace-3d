# Swarm manifest — Omega Ratrace 3D

`node tools/swarm-tracker/bin/swarm-plan.mjs` -> `docs/swarm/prompts/<id>.md` + `.tracker/plan.json`.
Spawn each agent with: "Read {{root}}/docs/swarm/prompts/<id>.md and execute it exactly." Max 4 concurrent. Waves: p1 (foundation) -> p2 (render/ui/audio/assets) -> p3 (integration, QA, models) -> p4 (release: screenshots, site, review, tag, GitHub Pages).

## @meta
project: Omega Ratrace 3D
tagline: Photoreal 3D Omega Race. Colby the cat vs the rats of the Mouse Hole. three.js + Blender.

## @preamble
You are subagent `{{id}}` ({{name}}) in a parallel swarm building **Omega Ratrace 3D** in `{{root}}`. Model tier: {{model}}.

Rules:
1. `ARCHITECTURE.md` and `src/core/defs.js` are the binding contract. List sections (`grep -n '^## ' ARCHITECTURE.md`), read only what you need with offset/limit.
2. You own ONLY: {{owns}}. Besides those you may write tests `test/{{id}}.test.mjs`, your report, and scratch output. Others write other modules right now: code against the contract, guard with fallbacks, never edit files you do not own; put needs under "Requests" in your report.
3. Progress: `node tools/swarm-tracker/bin/track.mjs {{id}} start "<plan>"`, then `progress <pct> "<msg>"` at 4+ milestones, finally `done "<result>"` (or `blocked`/`failed`). Run from {{root}}.
4. Verify for real: run it, test it, look at it (screenshots via `node tools/shot.mjs`). Report failures honestly.
5. If waiting on another agent's file, poll `for i in $(seq 90); do [ -f <path> ] && break; sleep 10; done`, then use a fallback.
6. Finish with `docs/swarm/reports/{{id}}.md`: What I built · Verification evidence · Deviations · Mistakes and fixes · Learnings · Requests. Report shared-code defects.
7. Chat output minimal. Final reply 8 lines max.
8. Save early. If your owned files exist you are RESUMING: inspect and continue.
9. No new dependencies beyond vendored three.js. NO git commands (orchestrator commits). Never kill processes you did not start.
10. Context budget: read with offset/limit or grep, pipe output through tail/grep (40 lines max), view images only when acting on them (~6 total).
11. Keep `docs/swarm/progress/{{id}}.md` (30 lines: Done · Next · Gotchas · Verify). After ~25 tool calls with work left, update it and END with `CONTINUE: <next step>`.
12. Stamp times with `date -u`. Temp/build/render output goes under /datanapps/claude-tmp or out/, NEVER /tmp. Blender: `/snap/bin/blender -b -P script.py`.

Your task:

## @role:asset
Role appendix: Blender-authored assets. Deliver glTF 2.0 .glb (PBR, named nodes, centred origin, size/orientation per ARCHITECTURE §6-7) AND watertight single-shell STL under assets/print/ (mm). Reuse patterns from ~/src/fun/game-factory/examples/ratops/blender/*.py and tools/print/print_export.py. Colby Jack cat look: marbled orange/cream. Render a preview PNG with EEVEE/Workbench (<=3 min) to out/previews/<name>.png and look at it at most twice. Scripts must be deterministic and re-runnable.

## @role:code
Role appendix: ES modules, Node-safe unless in src/render|ui|audio. Keep files <600 lines. Unit-test with node:test.

## vendor-three | haiku | p1 | tooling | Vendor three.js
owns: vendor/, index.html, style.css, tools/serve.mjs, tools/shot.mjs
Vendor three.js 0.187.0 into `vendor/three/` (get it with `npm pack three@0.187.0` inside /datanapps/claude-tmp/three, extract there, copy only build/three.module.js, build/three.core.js and the needed examples/jsm addons per ARCHITECTURE §2 incl. their relative deps). Write `index.html` with importmap (`three`, `three/addons/`), a full-window `<canvas id=game>`, overlay `<div id=ui>`, loading `src/main.js`; `style.css` dark neon. Make serve.mjs serve `.glb`, `.js`, `.json`, `.wasm` with correct MIME. Prove WebGL works in headless Chrome: a temp page rendering a lit PBR sphere via `tools/shot.mjs` (add swiftshader flags if needed) -> out/shots/webgl-ok.png. Document the exact working flags in your report.

## sim-core | sonnet | p1 | sim | Simulation core
owns: src/sim/game.js, src/sim/player.js, src/sim/shots.js, src/sim/collide.js, src/sim/score.js, src/sim/waves.js
Implement ARCHITECTURE §4: ship physics (rotate/thrust/drag/maxSpeed, bounce off arena rect and BOX, hairballs with one ricochet), collisions (circle vs circle/rect), lives/invuln/dying/respawn, yarn bomb, score/combo/extra lives, wave flow (intro → play → waveclear → next) with `buildWave(n, rng)` (difficulty ramp; Death Rat after TUNING.deathRatAfter), entity pool, events on the bus, state hash helper `g.hash()`. Call `BEHAVIORS[kind]` from `./enemies.js` (owned by sim-enemies; stub-guard if missing: `import * as E` in try/dynamic fallback not allowed, so export a `setBehaviors(map)` and default to an empty map; main wires it). Tests: determinism (same seed ⇒ same hash over 3000 ticks), bounce, shot ricochet, extra life, wave progression.

## sim-enemies | sonnet | p1 | sim | Enemy behaviours
owns: src/sim/enemies.js
Implement `BEHAVIORS` for mouse, rat (wall-aware homing), commander (slow, aimed cheese-pellet bursts, drops tuna on death), mine (drift, arm, burst into 6 crumb ebullets), deathrat (fast hunter, unkillable), tuna (pickup, 8 s expiry), per ARCHITECTURE §4 and defs.KINDS. Pure functions of (entity, dt, g); use `g.rng` only. Include a mock-`g` test harness in test/sim-enemies.test.mjs. Export `BEHAVIORS`.

## blender-colby | sonnet | p1 | asset | Colby ship model
owns: tools/blender/colby.py, assets/models/colby.glb, assets/print/colby.stl
Hero: Colby the cat as a sleek space-ship (cat body, ears, whiskers, tail as engine flame cone with emissive material, glass visor, subtle fur via normal/roughness bake). Marbled orange/cream Colby Jack fur. Photoreal PBR (fur sheen), ~0.44 m long, nose along +X. Provide a separate named node `Flame` (emissive) so the renderer can scale it with thrust. Print STL: single watertight shell, simplified (whiskers dropped or thickened to >=1.2 mm).

## blender-mice | sonnet | p1 | asset | Mice, rats and props
owns: tools/blender/mice.py, tools/blender/props.py, assets/models/mouse.glb, assets/models/rat.glb, assets/models/commander.glb, assets/models/deathrat.glb, assets/models/mine.glb, assets/models/tuna.glb, assets/models/yarn.glb, assets/models/hairball.glb, assets/print/
Photoreal mouse (grey-lilac, pink ears/tail, glossy eyes, whiskers), rat (bigger, purple-grey), commander (rat with epaulets + cheese-wedge badge), deathrat (black fur, red glowing eyes, larger), mine (Swiss cheese wheel, emissive armed light node `Armed`), tuna tin pickup, yarn ball, hairball (small emissive sphere). Sizes per ARCHITECTURE §6 (radius ≈ defs.KINDS[k].r*0.02 m). STL for the six characters/props that can be printed.

## render-scene | sonnet | p2 | render | Scene, camera, arena, entities
owns: src/render/renderer.js, src/render/scene.js, src/render/arena.js, src/render/entities.js, src/render/camera.js
Implement ARCHITECTURE §5-6: renderer, tilted camera with shake and subtle drift, procedural arena (glossy floor with cheese texture, neon-edged outer rail walls, central Mouse Hole box; use assets/models/arena.glb and mousehole.glb if present), GLB loader with primitive fallbacks, id-pooled entity meshes (Colby banks and scales `Flame` with thrust; spin on mines; Death Rat pulses), shadows, integration with render-post modules when present (dynamic import guarded by try/catch).

## render-post | sonnet | p2 | render | Lighting, post, FX
owns: src/render/lighting.js, src/render/post.js, src/render/fx.js, src/render/quality.js
Implement the render-post exports from ARCHITECTURE §5: procedural HDR environment (PMREM), key light + neon rim lights with soft shadows, composer chain (GTAO, bloom, grade/vignette/chromatic aberration/grain, ACES via OutputPass, SMAA), quality tiers with auto-downgrade on low FPS, GPU particle FX for all `defs.FX_TYPES`. Test via a temp page + tools/shot.mjs.

## blender-arena | sonnet | p2 | asset | Arena and Mouse Hole
owns: tools/blender/arena.py, assets/models/arena.glb, assets/models/mousehole.glb, assets/textures/
Arena floor/rail walls (800x450 logical → 16 x 9 m, centre origin) with tiled PBR cheese-and-brushed-metal textures baked ≤1024² (albedo, normal, roughness, emissive neon strip), and the central Mouse Hole box (BOX 420x190 → 8.4 x 3.8 m) styled as a giant cheese block with a mouse-hole arch where enemies spawn.

## audio | sonnet | p2 | audio | Audio synth
owns: src/audio/audio.js, src/audio/sfx.js, src/audio/music.js
Implement ARCHITECTURE §9-style audio from the 2D game’s contract: WebAudio synthesis only, every name in defs.SFX and defs.MUSIC, `createAudio({bus}) → {resume,setVolume,play,music,muted}`, Node-importable with offline stub, spatial pan from `x`. Music loops ≥16 bars, synthwave feel.

## ui-shell | sonnet | p2 | ui | UI, input, main
owns: index.html, style.css, src/main.js, src/core/input.js, src/ui/hud.js, src/ui/screens.js, src/ui/menus.js, src/ui/font.js
(index.html/style.css are first created by vendor-three; you then extend them.) Wire main.js: fixed-step loop, createGame + renderer + audio + HUD; keyboard (arrows/WASD rotate+thrust, Space fire, X bomb, P pause, M mute), gamepad, touch; DOM/CSS HUD (score, hi, lives as cat heads, bombs, wave, combo, taunt bubbles), title/pause/options (quality, volume)/gameover with initials (localStorage), URL params `autostart seed wave quality bot debug mute`.

## models-v2 | sonnet | p3 | asset | Photoreal model pass
owns: tools/blender/colby.py, tools/blender/mice.py, assets/models/colby.glb, assets/models/mouse.glb, assets/models/rat.glb, assets/models/commander.glb, assets/models/deathrat.glb, assets/print/colby.stl, assets/print/mouse.stl, assets/print/rat.stl, assets/print/commander.stl, assets/print/deathrat.stl
Current models are smooth stylised ellipsoids (see out/previews/colby.png, commander.png). Rebuild for photoreal: Colby with a proper cat silhouette (head with muzzle, haunches, four paws tucked in flight, curved tail ending in the engine flame), real fur (particle hair baked to cards or dense strand geometry plus fur-shader PBR with sheen) in Colby Jack marbling; mice/rats with sculpted heads, hair, translucent ears, glossy wet eyes, thin tails. Fix mouse size to about 0.2 m body (radius KINDS.r*0.02, tail excluded from the collision size). Keep GLB nodes (Flame, Armed, etc.), triangle budget, +X nose, and watertight single-shell STL. Update test/blender-*.test.mjs accordingly.

## fix-mine | sonnet | p3 | asset | Fix mine.stl shells
owns: tools/blender/props.py, assets/models/mine.glb, assets/models/tuna.glb, assets/models/yarn.glb, assets/models/hairball.glb, assets/print/mine.stl
tools/validate-assets.mjs reports assets/print/mine.stl has 3 disjoint shells. Fuse them into one watertight shell (voxel remesh/boolean union with a base or bridges, min wall >= 1.2 mm), keep mine.glb nodes (`Armed`). Re-run `node tools/validate-assets.mjs` until the whole run exits 0 (other STLs must still pass; do not edit files you do not own, report any other failures).

## qa-bot | sonnet | p3 | qa | Autopilot and bot tests
owns: src/sim/autopilot.js, tools/botplay.mjs
Deterministic autopilot (aim at nearest threat, thrust to dodge, fire) and `tools/botplay.mjs --waves N --seed S` reporting waves reached, deaths, score, state hash; proves determinism and that waves 1-5 are survivable but not trivial; flags tuning problems.

## asset-validate | sonnet | p3 | qa | Asset validation
owns: tools/validate-assets.mjs, tools/blender/validate.py, assets/manifest.json
Per ARCHITECTURE §7: Blender-headless validator (re-import every assets/print/*.stl: single shell, manifold, positive volume, bbox, min-wall estimate) and Node GLB structural checker (magic, JSON chunk, accessor bounds, triangle budget, all MODELS present). Write assets/manifest.json + a table into docs/ASSETS.md. Exit non-zero on failure.

## integrate | sonnet | p3 | integration | Integration and polish
owns: docs/INTEGRATION-NOTES.md
Also address qa-bot tuning flags: a wave can stall when mice bounce vertically in a lane behind the box (nudge their velocity or give them a small drift; keep 2D-compatible TUNING), and check bot wave times vs the 42 s Death Rat timer; fix ui-shell's unverified paths (game-over/initials, options, gamepad/touch wiring) in a browser run; enlarge ships relative to the arena if they look tiny. Wire everything (render-post requests to render-scene: on resize call fx.setViewportHeight(canvas.clientHeight) and post.resize(w,h); call lighting.setQuality/fx.setQuality along with post.setQuality; set castShadow/receiveShadow on meshes; verify sim-enemies against the real game.js and main calls setBehaviors(BEHAVIORS)), run `npm test`, `node tools/check-imports.mjs`, botplay, screenshots at low/high/ultra; fix cross-module contract drift by minimal edits (you may edit any file; record each edit in the notes). (The web build tool is owned by `site` in p4.) Confirm 60 fps target on `high` where hardware allows, report numbers.

## screenshots | sonnet | p4 | docs | Release screenshots
owns: docs/screenshots/, docs/site/img/, tools/capture-screens.mjs
After integrate and models-v2 are done: script `tools/capture-screens.mjs` (headless Chrome via tools/shot.mjs, swiftshader) that captures title, gameplay mid-wave with enemies/hairballs/FX, a Death Rat moment, pause, game over, and quality low vs ultra comparison, into docs/screenshots/ (1600x900 PNG, optimised, copy hero + 4 more into docs/site/img/). Also copy Blender preview renders of Colby and the rodents (out/previews) into docs/screenshots/models/ and make a contact sheet. View each shot at most once; reshoot if the framing is bad (use ?seed/?wave/?bot=1 for good moments).

## site | sonnet | p4 | docs | GitHub Pages site and build
owns: docs/site/, .github/workflows/pages.yml, tools/build-site.mjs, docs/BUILD.md, LICENSE, tools/build-web.mjs
Mirror catxzzon/duum conventions (see ~/src/fun/catxzzon/docs/site, .github/workflows/pages.yml, tools/build-web.mjs, docs/BUILD.md). Apache-2.0 LICENSE. tools/build-site.mjs assembles `dist/site/`: landing page (hero shot, features, controls, quality tiers, asset pipeline with STL/glTF info, screenshot gallery, download/play links) plus `play/` containing the web build (index.html, src, vendor, assets/models, assets/textures; fixed relative paths so it works under /omega-ratrace-3d/play/). GitHub Actions workflow deploys dist/site to Pages on push to main, running npm test first. Test the built site by serving dist/site and screenshotting play/ with tools/shot.mjs (no 404s).

## review | sonnet | p4 | review | Code and docs review
owns: README.md, docs/HOW-TO-PLAY.md, docs/LEARNINGS.md, docs/ARCH-OVERVIEW.md
Write after screenshots and site are done. Review the whole repo for bugs/contract drift (read-only except owned docs), write a polished README modelled on catxzzon/duum (badges, play link https://bsommers.github.io/omega-ratrace-3d/play/, screenshot table from docs/screenshots, features, controls, URL params, quality tiers, project layout, asset pipeline + STL printing, tracker, credits, license), HOW-TO-PLAY, ARCH-OVERVIEW and LEARNINGS (include mistakes from docs/swarm/reports/*). Report unfixed findings in docs/swarm/reports/review.md.
