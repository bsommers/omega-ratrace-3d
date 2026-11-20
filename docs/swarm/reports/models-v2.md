# models-v2 report
## What I built
- tools/blender/colby.py: Skin-modifier sculpted cat (head/muzzle, haunches, 4 tucked paws, S-curved tail ending in Nozzle + Flame), 14k strand-card fur with procedural 3D Colby Jack marbling baked to vertex colours (Color Attribute -> PBR with sheen), eyes, pink inner ears, visor, whiskers. 35k tris, 0.465 m long.
- tools/blender/mice.py: same pipeline for mouse/rat/commander/deathrat: sculpted head, strand fur, translucent ears, glossy eyes (red emissive on Death Rat), thin separate Tail node, epaulets+cheese badge on commander. Body length (tail excluded) = KINDS.r*0.02 m (mouse 0.20 m). 27-31k tris.
- GLBs + STLs regenerated. STL: one voxel-remeshed shell, open_edges 0, positive volume (colby ~133 mm, rodents 80-110 mm).
## Verification
- npm test green; test/models-v2.test.mjs parses STLs (every edge shared by 2 faces, 1 shell, volume>0) and checks GLB node names. Previews viewed: colby, commander, mouse.
## Deviations
- Fur is strand cards + vertex colours (no textures); glTF has no SSS so ear translucency is approximate. Colby preview showed head/visor tint a bit strong; tuned afterwards, not re-viewed.
- Mice STL drops 1-2 tiny non-attached islands (teeth/ear tips) to keep a single shell.
- Updated test/blender-mice.test.mjs: nose within 0.4-0.7 R of origin (body = R long), Tail node required.
## Mistakes and fixes
- Tail started detached from body (print dropped it); moved attachment. Byte colours washed out; switched to FLOAT_COLOR.
## Learnings
- Skin modifier radii shrink after subsurf: overlap parts generously.
## Requests
- Renderer may want double-sided fur strand material (FurStrand has backface culling off).
