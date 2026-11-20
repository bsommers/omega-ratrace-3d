# render-post report
## What I built
- `src/render/quality.js`: tiers low/medium/high/ultra config + `createAutoQuality` (EMA fps, downgrade after 2.5 s < 40 fps, cooldown).
- `src/render/lighting.js`: `build(scene,renderer,{quality}) -> {update(t), setQuality, key, rims, dispose}`. Procedural PMREM env (gradient dome + neon strips), warm key DirectionalLight w/ PCF shadows, hemisphere fill, 8 neon rim point lights.
- `src/render/post.js`: `createPost(renderer,scene,camera,quality) -> {render(dt), resize(w,h), setQuality, composer, passes}`. RenderPass, GTAO, UnrealBloom, grade (vignette/CA/grain/sat), OutputPass ACES, SMAA. `low` bypasses composer. Auto-downgrade built in (`autoQuality=false` to disable; opts.onDowngrade).
- `src/render/fx.js`: `createFx(scene,bus,{quality}) -> {update(dt), emit, setQuality, setViewportHeight, dispose}`. Single Points ring-buffer, analytic GPU motion; all 9 FX_TYPES; listens to bus `fx`.
- `test/render-post.test.mjs` (quality logic, 4 tests pass).
## Verification evidence
- `out/render-post/test.html`; screenshots `out/shots/rp-{ultra,high,low}.png` via swiftshader, no page errors. All FX types visible, bloom/rims/shadows visible.
## Deviations
- None to API. Extra exports: `createLighting`, `attach`, `create` aliases.
## Mistakes and fixes
- First lighting was overexposed (key 2.6, rims 18); reduced to 1.7 / 7 / env 0.55.
## Learnings
- OutputPass reads renderer.toneMapping; set to ACES in createPost. Do not set it again on the renderer.
## Requests
- render-scene: call `fx.setViewportHeight(canvas.clientHeight)` on resize; `post.resize(w,h)` with drawing-buffer px; call `lighting.setQuality(q)` alongside `post.setQuality(q)`; set `castShadow/receiveShadow` on meshes; call `fx.setQuality(q)` too. Shadows with swiftshader are subtle; not verified up close.
