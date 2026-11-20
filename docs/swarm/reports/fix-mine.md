# fix-mine report
## What I built
props.py export_stl now removes tiny stray islands after voxel remesh (keeps largest shell). Regenerated mine.stl/glb (and only mine).
## Verification evidence
mine.stl: 3 shells (two 4-vertex slivers at z=16.5) -> 1 shell, 0 non-manifold edges. `node tools/validate-assets.mjs` exit 0 ("assets OK (11 models)"). Armed node present in mine.glb.
## Deviations
Dropped slivers rather than adding a base/bridges; they were degenerate remesh artifacts, not real features.
## Mistakes and fixes
None.
## Learnings
Voxel remesh can leave 4-vertex coplanar slivers on flat faces.
## Requests
None.
