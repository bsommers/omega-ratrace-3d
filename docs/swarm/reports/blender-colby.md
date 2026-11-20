# blender-colby report
## What I built
tools/blender/colby.py -> assets/models/colby.glb (nodes Body, Head, EarL/R, FinL/R, Nose, Visor, Nozzle, Flame, 6 Whiskers under root `Colby`), assets/print/colby.stl (121x82x63 mm, 0.3 scale), out/previews/colby.png. Marbled orange/cream baked color + normal + roughness textures (512px, numpy-generated), sheen on fur. `Flame` has emissive material, origin at its base (scale X for thrust). Nose +X, sits on y>=0, ~0.45 m long incl. flame.
## Verification evidence
Blender run OK; STL: 1 island, 0 non-manifold edges, volume>0; test/blender-colby.test.mjs passes (Flame node, emissive, tris<=40k, length). Preview viewed 4x.
## Deviations
Print drops whiskers, visor and flame (solid body/head/ears/nozzle/fins voxel-remeshed). No minimum-wall measurement (solid shell; ear tips/fin edges may be <1.2 mm at 0.3 scale). Stylised primitives, not sculpted fur. Preview shows flame pale (tone mapping).
## Mistakes and fixes
Blender image.pixels assignment produced black textures; now write PNG via zlib and load it.
## Learnings
Blender 5.3 EEVEE engine id works via enum check; Workbench with COLBY_WB=1 for debugging.
## Requests
None.
