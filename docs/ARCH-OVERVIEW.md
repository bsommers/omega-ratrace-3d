# Architecture overview

Binding contract: [../ARCHITECTURE.md](../ARCHITECTURE.md) and `src/core/defs.js` (frozen). This page is a map.

```
            +-----------------------------+
 input ---> | src/main.js fixed 1/60 loop | ---> bus (src/core/events.js)
            +--------------+--------------+          |  sfx fx shake flash hitstop popup
                           |                          |  wave banner score life bombs ...
              g.update(dt, input)                     v
            +--------------v--------------+   +--------------+   +----------+   +--------+
            | src/sim  (pure, seeded,     |   | src/render   |   | src/audio|   | src/ui |
            | no three, no DOM)           |   | three.js     |   | WebAudio |   | HUD    |
            +-----------------------------+   +--------------+   +----------+   +--------+
```

- **Sim** is logical 2D, 800x450. State: `g.state` (intro, play, dying, waveclear, gameover), `g.ship`, `g.ents[]`. Enemy behaviours (`BEHAVIORS` in `sim/enemies.js`) are injected via `setBehaviors` in main. All randomness comes from `g.rng` (seeded), so the same seed and inputs give the same state hash; `tools/botplay.mjs` relies on this.
- **Render** maps sim (x,y) to three `(x*S - W*S/2, 0, y*S - H*S/2)`, S = 0.02 m. Models are Y-up metres, nose on +X, `rotation.y = -angle`. Entity meshes are pooled by id; missing GLBs fall back to primitives. `quality.js` holds tier config and the FPS auto-downgrade; `post.js` owns the composer (bloom, GTAO, SMAA, OutputPass with ACES).
- **Audio** synthesises every name in `defs.SFX` and `defs.MUSIC` and reacts to bus events.
- **Assets**: Blender scripts in `tools/blender/` emit GLB (runtime) and STL (printing); `tools/validate-assets.mjs` gates both.
- **Web build**: no bundler. Importmap in `index.html` resolves `three` and `three/addons/` to `vendor/three`. `tools/build-site.mjs` copies it to `dist/site/play/`.

## Deviations from ARCHITECTURE.md (as built)
- Camera tilt is 67 degrees (doc says ~55); raised twice to reduce occlusion by the box.
- Entity meshes are scaled by `VIS = 2.5` over true size; the Mouse Hole GLB is squashed to `scale.y = 0.3`.
- Mouse behaviour adds a sideways drift when |vx| is under 25% of speed (2D-compatible fix for vertical-lane stalls).
