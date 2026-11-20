# Colby the cat as a space-ship, photoreal pass (skin-modifier sculpt + strand-card fur + PBR).
# Run: /snap/bin/blender -b -P tools/blender/colby.py     (env COLBY_OUT overrides preview path)
# Blender Z-up, nose +X (glTF export keeps +X, Z->Y). Metres. Deterministic (fixed seeds).
import bpy, bmesh, math, os, numpy as np
from mathutils import Vector
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GLB = os.path.join(REPO, "assets/models/colby.glb")
STL = os.path.join(REPO, "assets/print/colby.stl")
PREV = os.path.join(REPO, "out/previews/colby.png")
for p in (os.path.dirname(GLB), os.path.dirname(STL), os.path.dirname(PREV)): os.makedirs(p, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.RandomState(7)
NBLADES = 14000

# ---------- procedural 3D marbling (sum of sines = cheap deterministic noise) ----------
_K = rng.randn(12, 3) * 1.0; _K /= np.linalg.norm(_K, axis=1, keepdims=True); _PH = rng.rand(12) * 6.283
_F = np.array([9, 14, 22, 31, 47, 70, 11, 19, 38, 55, 83, 120.0])
def n3(p):
    s = np.zeros(len(p))
    for i in range(12): s += np.sin(p @ _K[i] * _F[i] + _PH[i]) / (_F[i] ** 0.45)
    return s / 3.0
def colby_color(p):
    q = p * np.array([1.0, 1.0, 1.0])
    warp = n3(q * 0.55)
    m = np.sin((q[:, 0] * 14 + q[:, 2] * 9 + warp * 5.5) * 1.0) * 0.5 + 0.5      # large marble bands
    m2 = np.sin((q[:, 1] * 17 + q[:, 2] * 12 - warp * 4.0)) * 0.5 + 0.5
    cream_w = np.clip((m * 0.6 + m2 * 0.4 - 0.62) * 5.0, 0, 1)
    cream_w = np.clip(cream_w + np.clip((0.07 - q[:, 2]) * 8, 0, 0.8), 0, 1)       # pale belly
    fine = n3(q * 6.0) * 0.12
    orange = np.array([0.88, 0.30, 0.02]); cream = np.array([0.93, 0.70, 0.40])
    c = orange[None] * (1 - cream_w[:, None]) + cream[None] * cream_w[:, None]
    return np.clip(c * (1.0 + fine[:, None]), 0, 1)

# ---------- materials ----------
def mat(name, **kw):
    mt = bpy.data.materials.new(name); mt.use_nodes = True
    b = mt.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return mt, b
def vcol_mat(name, **kw):
    mt, b = mat(name, **kw)
    n = mt.node_tree.nodes.new("ShaderNodeVertexColor"); n.layer_name = "Color"
    mt.node_tree.links.new(n.outputs["Color"], b.inputs["Base Color"]); return mt
fur_m = vcol_mat("Fur", **{"Roughness": 0.62, "Sheen Weight": 0.35, "Sheen Roughness": 0.35, "Sheen Tint": (1.0, 0.6, 0.3, 1)})
blade_m = vcol_mat("FurStrand", **{"Roughness": 0.5, "Sheen Weight": 0.4, "Sheen Roughness": 0.3, "Sheen Tint": (1.0, 0.65, 0.35, 1)})
blade_m.use_backface_culling = False
glass, _ = mat("Visor", **{"Base Color": (0.1, 0.4, 0.6, 1), "Roughness": 0.04, "Metallic": 0.0, "Alpha": 0.12})
metal, _ = mat("Nozzle", **{"Base Color": (0.55, 0.57, 0.62, 1), "Metallic": 1.0, "Roughness": 0.28})
flame_m, _ = mat("FlameMat", **{"Base Color": (1, 0.5, 0.1, 1), "Emission Color": (1.0, 0.45, 0.08, 1), "Emission Strength": 6.0, "Roughness": 0.5})
pink, _ = mat("PinkSkin", **{"Base Color": (0.95, 0.5, 0.52, 1), "Roughness": 0.45, "Subsurface Weight": 0.3, "Subsurface Radius": (1.0, 0.3, 0.2)})
eye_m, _ = mat("EyeGloss", **{"Base Color": (0.55, 0.62, 0.08, 1), "Roughness": 0.03, "Coat Weight": 1.0, "Coat Roughness": 0.0})
pupil_m, _ = mat("Pupil", **{"Base Color": (0.0, 0.0, 0.0, 1), "Roughness": 0.03, "Coat Weight": 1.0, "Coat Roughness": 0.0})
whisk, _ = mat("Whisker", **{"Base Color": (0.95, 0.93, 0.85, 1), "Roughness": 0.35})

def fin(o, name, mt):
    o.name = name; o.data.name = name
    if mt: o.data.materials.append(mt)
    for p in o.data.polygons: p.use_smooth = True
    return o
def ell(name, c, r, mt, seg=32, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=c)
    o = bpy.context.object; o.scale = r; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); return fin(o, name, mt)
def cone(name, c, r1, r2, d, mt, rot=(0, math.pi / 2, 0), v=32):
    bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r1, radius2=r2, depth=d, location=c, rotation=rot)
    o = bpy.context.object; bpy.ops.object.transform_apply(rotation=True); return fin(o, name, mt)

def skin_body(name, pts, edges, sub=3):
    """pts: (x,y,z,r) -> organic one-piece mesh via Skin modifier."""
    me = bpy.data.meshes.new(name); me.from_pydata([p[:3] for p in pts], edges, [])
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    sk = o.modifiers.new("skin", "SKIN"); sk.use_smooth_shade = True
    for i, p in enumerate(pts):
        d = me.skin_vertices[0].data[i]; d.radius = (p[3], p[3] * (p[4] if len(p) > 4 else 1.0)); d.use_root = (i == 0)
    sb = o.modifiers.new("sub", "SUBSURF"); sb.levels = sub; sb.render_levels = sub
    bpy.ops.object.modifier_apply(modifier="skin"); bpy.ops.object.modifier_apply(modifier="sub")
    for p in o.data.polygons: p.use_smooth = True
    return o

# ---------- skeleton: spine, tail, legs, head ----------
P = {}
spine = [("hip", -0.105, 0, 0.100, 0.070), ("mid", -0.035, 0, 0.108, 0.064), ("chest", 0.04, 0, 0.112, 0.068),
         ("neck", 0.095, 0, 0.125, 0.052), ("head", 0.138, 0, 0.140, 0.058), ("cheek", 0.170, 0, 0.132, 0.052),
         ("muzzle", 0.195, 0, 0.124, 0.030), ("nose", 0.208, 0, 0.126, 0.014)]
tail = [("t0", -0.150, 0, 0.104, 0.034), ("t1", -0.176, 0, 0.130, 0.028), ("t2", -0.178, 0, 0.170, 0.024),
        ("t3", -0.160, 0, 0.206, 0.0225), ("t4", -0.185, 0, 0.226, 0.0225)]
legs = []
for s, sn in ((1, "L"), (-1, "R")):
    legs += [("th" + sn, -0.085, s * 0.052, 0.085, 0.036), ("hp" + sn, -0.040, s * 0.058, 0.044, 0.020), ("hf" + sn, -0.006, s * 0.056, 0.030, 0.015),
             ("sh" + sn, 0.055, s * 0.045, 0.082, 0.026), ("fp" + sn, 0.105, s * 0.040, 0.056, 0.0165), ("ff" + sn, 0.130, s * 0.038, 0.050, 0.013)]
names = [n for n, *_ in spine + tail + legs]
pts = [(x, y, z, r) for _, x, y, z, r in spine + tail + legs]
ix = {n: i for i, n in enumerate(names)}
E = [(ix[spine[i][0]], ix[spine[i + 1][0]]) for i in range(len(spine) - 1)]
E += [(ix["hip"], ix["t0"])] + [(ix[tail[i][0]], ix[tail[i + 1][0]]) for i in range(len(tail) - 1)]
for sn in "LR":
    E += [(ix["hip"], ix["th" + sn]), (ix["th" + sn], ix["hp" + sn]), (ix["hp" + sn], ix["hf" + sn]),
          (ix["chest"], ix["sh" + sn]), (ix["sh" + sn], ix["fp" + sn]), (ix["fp" + sn], ix["ff" + sn])]
body = skin_body("Body", pts, E, sub=3)
# tuck cheek width: scale body slightly wider at head via sculpt-free approach: leave as is.
body.data.materials.clear(); body.data.materials.append(fur_m)

# head as a named node: duplicate nothing; keep Body+Head split by marker empties? -> Head is a separate sculpt for muzzle/brow detail
brow = ell("Head", (0.152, 0, 0.145), (0.074, 0.068, 0.062), fur_m, 48)
# ears: flattened cones with pink inner
def ear(sn, s):
    o = cone("Ear" + sn, (0.140, s * 0.050, 0.200), 0.036, 0.0, 0.075, fur_m, rot=(-s * 0.35, -0.12, 0), v=24)
    o.scale = (0.55, 1.0, 1.0); bpy.ops.object.transform_apply(scale=True)
    i = cone("EarInner" + sn, (0.144, s * 0.050, 0.197), 0.024, 0.0, 0.058, pink, rot=(-s * 0.35, -0.12, 0), v=24)
    i.scale = (0.5, 0.9, 1.0); bpy.ops.object.transform_apply(scale=True)
    return o
earL, earR = ear("L", 1), ear("R", -1)
nose = ell("Nose", (0.2155, 0, 0.1275), (0.010, 0.013, 0.009), pink, 20)
eyes = []
for s, sn in ((1, "L"), (-1, "R")):
    e = ell("Eye" + sn, (0.188, s * 0.037, 0.152), (0.0125, 0.0115, 0.0125), eye_m, 24)
    p = ell("Pupil" + sn, (0.1995, s * 0.0385, 0.152), (0.0035, 0.0035, 0.0105), pupil_m, 16)
    eyes += [e, p]
visor = ell("Visor", (0.160, 0, 0.150), (0.086, 0.080, 0.074), glass, 40)
nozzle = cone("Nozzle", (-0.202, 0, 0.226), 0.027, 0.034, 0.030, metal)
bpy.context.scene.cursor.location = (-0.217, 0, 0.226)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.034, radius2=0.0, depth=0.05, location=(-0.242, 0, 0.226), rotation=(0, -math.pi / 2, 0))
fl = bpy.context.object; bpy.ops.object.transform_apply(rotation=True); fin(fl, "Flame", flame_m)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# ---------- vertex colours (marbling) ----------
def paint(o):
    me = o.data; M = o.matrix_world
    co = np.array([(M @ v.co)[:] for v in me.vertices]); c = colby_color(co)
    ca = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    loops = np.zeros(len(me.loops), dtype=np.int64); me.loops.foreach_get("vertex_index", loops)
    rgba = np.ones((len(loops), 4)); rgba[:, :3] = c[loops] ** 2.2
    ca.data.foreach_set("color", rgba.ravel())
paint(body); paint(brow)
for e in (earL, earR): paint(e)

# ---------- fur strand cards over body + head ----------
def blades(src_objs, n, seed):
    r = np.random.RandomState(seed)
    tris = []
    for o in src_objs:
        me = o.data; me.calc_loop_triangles(); me.calc_normals() if hasattr(me, "calc_normals") else None
        M = o.matrix_world
        for t in me.loop_triangles:
            a, b, c = [M @ me.vertices[i].co for i in t.vertices]
            nrm = (b - a).cross(c - a); area = nrm.length * 0.5
            if area > 0: tris.append((a, b, c, nrm.normalized(), area))
    ar = np.array([t[4] for t in tris]); pr = ar / ar.sum()
    pick = r.choice(len(tris), size=n, p=pr)
    V, F, C = [], [], []
    for k in pick:
        a, b, c, nrm, _ = tris[k]
        u, v = r.rand(2)
        if u + v > 1: u, v = 1 - u, 1 - v
        p = a + (b - a) * u + (c - a) * v
        if nrm.z < -0.6 and p.z < 0.06: continue        # skip underside
        flow = Vector((-1.0, 0, -0.1)) if p.x < 0.19 else Vector((-0.3, 0, 0.0))     # fur lies back along the body
        d = (nrm * (0.35 + 0.25 * r.rand()) + flow.normalized() * 0.8).normalized()
        L = (0.008 + 0.008 * r.rand()) * (0.6 if p.x > 0.15 else 1.0)
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4: side = Vector((0, 1, 0))
        side.normalize(); w = 0.0022 + 0.001 * r.rand()
        tip = p + d * L + Vector((r.randn(), r.randn(), r.randn())) * 0.0012
        i0 = len(V); V += [p - side * w, p + side * w, tip]; F.append((i0, i0 + 1, i0 + 2))
    return V, F
V, F = blades([body, brow], NBLADES, 11)
bm_ = bpy.data.meshes.new("FurStrands"); bm_.from_pydata([v[:] for v in V], [], F)
fo = bpy.data.objects.new("FurStrands", bm_); bpy.context.scene.collection.objects.link(fo)
bm_.materials.append(blade_m)
col = colby_color(np.array([v[:] for v in V])); ca = bm_.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
loops = np.zeros(len(bm_.loops), dtype=np.int64); bm_.loops.foreach_get("vertex_index", loops)
rgba = np.ones((len(loops), 4)); lc = col[loops]
tipmask = (loops % 3 == 2)[:, None]; rgba[:, :3] = np.where(tipmask, np.clip(lc * 1.12 + 0.02, 0, 1) ** 2.2, (lc * 0.8) ** 2.2)
ca.data.foreach_set("color", rgba.ravel())

# whiskers (thin tapered tubes)
def whisker(name, p0, p1, p2):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.0007; cu.bevel_resolution = 1; cu.resolution_u = 6
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    for bp, p in zip(sp.bezier_points, (p0, p1, p2)): bp.co = p; bp.handle_left_type = bp.handle_right_type = "AUTO"
    for i, bp in enumerate(sp.bezier_points): bp.radius = (1.0, 0.7, 0.25)[i]
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target="MESH")
    o = bpy.context.object; o.data.materials.append(whisk); return fin(o, name, None)
whiskers = []
for s, sn in ((1, "L"), (-1, "R")):
    for i, dz in enumerate((0.012, 0.0, -0.012)):
        whiskers.append(whisker("Whisker%s%d" % (sn, i), (0.198, s * 0.022, 0.124 + dz * 0.4),
                                (0.205, s * 0.07, 0.126 + dz * 1.5), (0.19, s * 0.125, 0.12 + dz * 3.0)))

# ---------- print shell: single voxel-remeshed watertight shell ----------
bpy.ops.object.select_all(action="DESELECT")
dups = []
for o in [body, brow, earL, earR, nozzle]:
    d = o.copy(); d.data = o.data.copy(); d.data.materials.clear(); bpy.context.collection.objects.link(d); dups.append(d)
for d in dups: d.select_set(True)
bpy.context.view_layer.objects.active = dups[0]
bpy.ops.object.join(); pr = bpy.context.object; pr.name = "PrintShell"
pr.modifiers.new("rm", "REMESH"); pr.modifiers["rm"].mode = "VOXEL"; pr.modifiers["rm"].voxel_size = 0.0035; pr.modifiers["rm"].adaptivity = 0.0
bpy.ops.object.modifier_apply(modifier="rm")
bm = bmesh.new(); bm.from_mesh(pr.data)
open_e = sum(1 for e in bm.edges if not e.is_manifold)
seen = set(); isl = 0
for f in bm.faces:
    if f.index in seen: continue
    isl += 1; st = [f]; seen.add(f.index)
    while st:
        c = st.pop()
        for e in c.edges:
            for g in e.link_faces:
                if g.index not in seen: seen.add(g.index); st.append(g)
vol = bm.calc_volume(); bm.free()
pr.scale = (300.0,) * 3; bpy.ops.object.transform_apply(scale=True)   # metres -> mm at 0.3 print scale
bpy.ops.object.select_all(action="DESELECT"); pr.select_set(True); bpy.context.view_layer.objects.active = pr
bpy.ops.wm.stl_export(filepath=STL, export_selected_objects=True)
print("PRINT islands=%d open_edges=%d vol_m3=%.6g dims_mm=%s" % (isl, open_e, vol, tuple(round(x, 1) for x in pr.dimensions)))
bpy.data.objects.remove(pr)

# ---------- glb ----------
bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.name = "Colby"
allo = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.context.view_layer.update()
lo = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in allo)
for o in allo: o.parent = root
root.location.z = -lo
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
print("GLB tris", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in allo))

# ---------- preview ----------
if not os.environ.get("COLBY_NOPREV"):
    sc = bpy.context.scene
    en = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in en else "BLENDER_EEVEE"
    if hasattr(sc.eevee, "taa_render_samples"): sc.eevee.taa_render_samples = 24
    sc.render.resolution_x, sc.render.resolution_y = 1000, 560
    w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.12, 0.13, 0.17, 1); sc.world = w
    for loc, e, sz in (((0.5, -0.6, 0.8), 45, 0.7), ((-0.5, 0.4, 0.5), 18, 0.6)):
        bpy.ops.object.light_add(type="AREA", location=(loc[0], loc[1], loc[2] + root.location.z)); l = bpy.context.object; l.data.energy = e; l.data.size = sz
        l.rotation_euler = (math.radians(60), 0, math.radians(45))
    bpy.ops.object.camera_add(location=(0.25, -0.85, 0.50)); cam = bpy.context.object
    tgt = Vector((-0.01, 0, 0.17 + root.location.z)); cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler(); sc.camera = cam
    cam.data.lens = 40
    sc.render.filepath = os.environ.get("COLBY_OUT", PREV); bpy.ops.render.render(write_still=True)
print("DONE")
