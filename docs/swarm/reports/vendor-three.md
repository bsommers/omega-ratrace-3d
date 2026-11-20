# vendor-three report

## What I built
- `vendor/three/`: three.js 0.187.0 from `npm pack`. Contains `build/three.module.js`, `build/three.core.js`, 25 addon files under `examples/jsm/` (GLTFLoader, EffectComposer, RenderPass, UnrealBloomPass, SSAOPass, GTAOPass, OutputPass, SMAAPass, RoomEnvironment, RGBELoader, HDRLoader and their relative deps), plus `LICENSE`. 2.5 MB. All 27 relative imports resolve.
- `index.html`: importmap (`three` to `build/three.module.js`, `three/addons/` to `examples/jsm/`), full-window `<canvas id="game">`, overlay `<div id="ui">` with loading splash, `<script type="module" src="src/main.js">`.
- `style.css`: dark neon tokens on `:root`, canvas fill with dvh, `.neon-panel`, `.neon-button`, `.hidden`, phone breakpoint, reduced-motion.
- `tools/serve.mjs`: added `.glb` (model/gltf-binary) and `.gltf` (model/gltf+json). `.js`, `.json`, `.wasm` were already mapped.
- `tools/shot.mjs`: default scratch dir moved from `os.tmpdir()` (/tmp) to `$CLAUDE_CODE_TMPDIR` or `/datanapps/claude-tmp/game-shot`.

## Verification evidence
- `out/shots/webgl-ok.png`: lit PBR sphere (MeshStandardMaterial, RoomEnvironment PMREM, directional shadow, ACES tone mapping) rendered by headless Chrome.
- `out/shots/index-loading.png`: index.html loading overlay renders. Only error is the expected 404 for `src/main.js`, which another agent owns.
- Server returns 200 with correct MIME for `/`, `/index.html`, `/style.css`, three.module.js, three.core.js.

Working headless flags (from `gpuFlags('swiftshader')` in tools/shot.mjs):
`node tools/shot.mjs --url "/out/vendor-three/webgl-test.html" --out out/shots/webgl-ok.png --size 800x450 --wait-for "window.__webglOk && window.__webglOk.ready" --wait 500 --gpu swiftshader`
Chrome flags: `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Chrome binary is `/usr/bin/google-chrome`.

## Deviations
- Did not write `test/vendor-three.test.mjs`. Nothing in the task required it.
- Test page lives at `out/vendor-three/webgl-test.html` (repo-local `out/`, not `/tmp`).

## Mistakes and fixes
- First draft of the shot.mjs profile-dir line was convoluted. Simplified it and dropped the unused `os` import.

## Learnings
- Addon crawl: follow relative imports from the seed files, not just the listed names. Pulls in shaders, ShaderPass, Pass, MaskPass, BufferGeometryUtils, SkeletonUtils, SimplexNoise, HDRLoader.
- The `vendor/three` tree has no bare `three/...` imports besides `three` itself, so the importmap is the only resolution path.

## Requests
- ui-shell / orchestrator: `src/main.js` does not exist yet. index.html loads it and shows the loading splash until it does.
- Shared-code defects: none found.
