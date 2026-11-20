# Integration notes (integrate agent)

## Edits to files owned by others
- `src/main.js`: import and call `setBehaviors(BEHAVIORS)` (was never wired, enemies had no behaviours in browser); orientationchange resize.
- `src/render/renderer.js`: resize calls `fx.setViewportHeight(canvas.clientHeight)` (and post.resize already); setQuality also calls `lighting.setQuality` and `fx.setQuality`.
- `src/render/entities.js`: `VIS = 2.5` visual scale on all entity meshes (ships/mice were tiny).
- `src/render/arena.js`: mousehole GLB (2.2 m tall) squashed `scale.y = 0.3`; fallback box height 0.22. The tall box hid the ship's spawn lane (y=70).
- `src/render/camera.js`: TILT 55 -> 62 deg (less occlusion by box).
- `src/sim/enemies.js`: mouse update drifts sideways when |vx| < 25% of speed (fixes vertical-lane stalls; 2D-compatible).
- `index.html`: `<link rel="icon" href="data:,">` to remove 404.

## Verified
npm test 46 pass; check-imports 0 errors; botplay seeds 1-6 deterministic; headless Chrome zero console errors at low/high/ultra, 60.7 fps (vsync cap) on all.
Browser: game-over initials save (localStorage scores), options slider writes settings, touch FIRE button sets touch.fire, gamepad axis/trigger polled.

## Open
Bot reaches waves 4-6 in 5-wave runs, dies often (3 deaths typical); avg wave ~31 s (seed 5) vs 42 s Death Rat. Bot-only concern.
