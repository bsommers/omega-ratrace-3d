# blender-arena report (2026-11-20T11:28:59Z)
## What I built
tools/blender/arena.py (reuses tools/blender/props.py helpers). arena.glb: ArenaFloor slab (top y=0) + 4 Rail* walls outside the 16x9 m play area (total 16.6x9.6 m, wall 0.5 m high), 60 tris. mousehole.glb: MouseHoleBlock 8.4x2.2x3.8 m beveled Colby-Jack cheese with 16 dimples and a 1.5 m arch tunnel through the Z axis (arch on both long faces), dark ShadowPlate/ShadowPlateTop visual backdrop, ~1.2k tris. Textures (1024 max) in assets/textures/: arena_floor_{albedo,normal,mr} (checker brushed-metal / cheese panels), arena_wall_{albedo,normal,mr,emissive} (1024x256, cyan/orange neon strip), mousehole_cheese_{albedo,normal}. STL (mm, single shell): arena 200 mm, mousehole 168 mm.
## Verification evidence
Blender run OK; STL non_manifold_edges=0, shells=1 both; ray-cast confirmed tunnel open and roof solid; ortho front render shows arch; node test test/blender-arena.test.mjs; previews out/previews/{arena,mousehole}.png.
## Deviations
Walls outside floor rectangle. Floor top at y=0 (slab below; ground() disabled). Arch is a through-tunnel (both faces). mr map is packed G=rough B=metal. Preview camera angle is a bit odd (arena.png shows floor+rails+cheese block composite).
## Mistakes and fixes
Setting Non-Color before img.save() wrote black PNGs; now set after save.
## Learnings
Blender exporter packs rough/metal via SeparateColor G/B.
## Requests
Renderer: arena.glb is a floor+rails; hole centered at origin matches BOX centre (400,225 -> origin). Material doubleSided; emissive wall strip needs bloom.
