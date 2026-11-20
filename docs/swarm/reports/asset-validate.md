# asset-validate report
## What I built
- tools/validate-assets.mjs: GLB check (magic, version/length, JSON chunk, bufferView/accessor bounds, index max, tri budget 40k, named nodes, all `MODELS` present), runs Blender validator, writes assets/manifest.json and the table in docs/ASSETS.md. Exit 1 on failure. Flags: --no-blender --no-write --optional=a,b --tri-budget=N.
- tools/blender/validate.py: re-reads every assets/print/*.stl: shells, non-manifold edges, signed volume, bbox, min-wall (inward raycast, 2nd percentile, threshold 1.2 mm).
- test/asset-validate.test.mjs (2 tests).
## Verification evidence
Full run: all 11 GLBs OK; 8/9 STLs OK; exit 1 on mine.stl (shells=3). Tests pass.
## Deviations
Min wall is a sampled estimate (3000 faces), not exact. GLB bbox is mesh-local (node scale ignored; shows 2x2x2 for unit meshes) as `meshBboxM`.
## Mistakes and fixes
bmesh sequences cannot be sliced; wrapped in list().
## Learnings
Blender 5.3 headless validate takes ~14 s.
## Requests
Owner of tools/blender/props.py: assets/print/mine.stl has 3 disjoint shells (genuine failure); fuse or union them. 
