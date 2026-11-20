# blender-mice report
## What I built
- tools/blender/props.py (shared helpers + mine/tuna/yarn/hairball), tools/blender/mice.py (mouse/rat/commander/deathrat).
- assets/models/{mouse,rat,commander,deathrat,mine,tuna,yarn,hairball}.glb; assets/print/*.stl (all 8; 30-110 mm longest, voxel-remeshed single shell, Z-up).
- Run: `blender -b -P tools/blender/mice.py -- all [--preview]`, same for props.py. Deterministic (fixed seeds).
## Verification
- test/blender-mice.test.mjs 8/8 pass (GLB magic, tris<=40k, y>=0, size vs r*0.02, nose +X, `Armed` node on mine, STL exists).
- STL: 0 non-manifold edges, 1 shell, positive volume for all 8 (RESULT lines from scripts). Previews: out/previews/<name>.png (viewed mine, commander, deathrat).
## Deviations
- Forward is +X per ARCHITECTURE s6 (defs.js comment says -Z; conflicting).
- Textures baked procedural numpy 512px, no real hair cards; "fur" = albedo+normal map on smooth ellipsoids (low poly, 2k-11k tris).
- Radius: body bounding radius = r*0.02, tail extends beyond (mouse total length 0.55 m, ARCH says ~0.2 m: ambiguous).
- Min-wall 1.2 mm checked only by construction (tail >=2 mm dia, voxel 0.5-0.6 mm), not measured. Whiskers, Armed light, tuna Tab and commander fringe excluded from STL.
- Yarn marbled orange/cream (Colby look). Mine cheese holes via exact booleans.
## Mistakes and fixes
- bmesh cone axis is Z (rotated to Y); stale bound_box after data.transform (fixed: view_layer.update in bbox()); thin tail broke under voxel remesh (thickened); commander badge/epaulets floated (re-seated).
## Learnings
- Exporter with export_yup=False passes scene coords through; scene authored Y-up. Meshes are unit spheres + node scale in glTF.
## Requests
- Orchestrator: tools/validate-assets.mjs / manifest.json entries for these 8 models (not owned by me); ensure renderer reads node scale (standard glTF).
