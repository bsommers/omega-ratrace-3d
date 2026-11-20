# Learnings

Drawn from `docs/swarm/reports/*`.

## Mistakes and what fixed them
| Area | Mistake | Fix |
|---|---|---|
| Integration | `main` never called `setBehaviors(BEHAVIORS)`: enemies were inert in the browser though unit tests passed | wired in main; add a browser-level smoke test |
| Rendering | Ship invisible: spawn lane hidden behind the 2.2 m Mouse Hole GLB | squash box to `scale.y = 0.3`, steeper camera tilt (better: bake height into the GLB) |
| Rendering | GLB base path was page-relative, 404 from `/out/` | resolve from `import.meta.url` |
| Lighting | First rig overexposed (key 2.6, rims 18); floor blew out under bloom | key 1.7, rims 7, env 0.55, darker floor |
| Lighting | `OutputPass` reads `renderer.toneMapping`; setting it twice double-mapped | set ACES once in `createPost` |
| Lighting | `PCFSoftShadowMap` removed in vendored three: console warning | use a supported shadow map type |
| Blender | `image.pixels` assignment and setting Non-Color before `img.save()` produced black textures | write PNG via zlib then load; set colour space after save |
| Blender | Bad geometry: stale `bound_box`, thin tail lost under voxel remesh, detached tail, floating badge, skin radii shrink after subsurf | `view_layer.update`, thicken, re-seat, overlap parts generously |
| Blender | bmesh sequences cannot be sliced; voxel remesh leaves coplanar slivers; mine STL had 3 shells | `list()`, clean up, fuse the parts |
| Blender | Byte vertex colours looked washed out | `FLOAT_COLOR` |
| Sim | Mice bouncing purely vertically behind the box were unkillable; waves stalled into the 42 s Death Rat | sideways drift when |vx| < 25% of speed |
| Bot | First autopilot camped at spawn | waypoint roaming; dodge radius 70 beat 95/130 |
| Test tooling | Port 8765 held by a foreign process | left alone, used another port |
| Screenshots | Fixed waits timed out on software GL (entity count 14) | wait for 8 entities, longer budgets |
| Code | Param `startWave` shadowed an inner function | renamed |

## Practices that worked
- A frozen contract (`defs.js`, ARCHITECTURE.md) let a dozen agents write modules in parallel without merge friction.
- Procedural fallbacks for every model meant the game always ran while assets were still being built.
- Node-safe sim and a fake AudioContext let CI exercise logic and synth graphs headlessly.
- Determinism (seeded rng, fixed 1/60 step) made the bot a regression test.
- Check GLB sizes against sim units early, and test full browser wiring, not only modules.
- Headless Blender 5.3 validation takes about 14 s; a software-GL screenshot 20-60 s (full set about 6 min).
