# Colby the cat as a space-ship. Run: /snap/bin/blender -b -P tools/blender/colby.py
# Blender Z-up, nose +X (glTF export keeps +X). Metres. Deterministic.
import bpy, bmesh, math, os, numpy as np
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GLB = os.path.join(REPO, "assets/models/colby.glb")
STL = os.path.join(REPO, "assets/print/colby.stl")
PREV = os.path.join(REPO, "out/previews/colby.png")
SCR = "/datanapps/claude-tmp/omega-colby"
for p in (os.path.dirname(GLB), os.path.dirname(STL), os.path.dirname(PREV), SCR): os.makedirs(p, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng = np.random.RandomState(7)

def noise(n, cells):
    g = rng.rand(cells + 1, cells + 1); g[-1] = g[0]; g[:, -1] = g[:, 0]
    xs = np.linspace(0, cells, n, endpoint=False); i = xs.astype(int); f = xs - i; f = f * f * (3 - 2 * f)
    a = g[i][:, i]; b = g[i][:, i + 1]; c = g[i + 1][:, i]; d = g[i + 1][:, i + 1]
    fx = f[:, None]; fy = f[None, :]
    return (a * (1 - fx) * (1 - fy) + c * fx * (1 - fy) + b * (1 - fx) * fy + d * fx * fy)

N = 512
h = sum(noise(N, 4 * 2 ** k) / 2 ** k for k in range(5)); h /= h.max()
m = np.sin((noise(N, 3) * 5 + h * 4) * math.pi * 2) * 0.5 + 0.5          # marbling
m = np.clip((m - 0.35) * 2.2, 0, 1)
orange = np.array([0.9, 0.3, 0.03]); cream = np.array([0.95, 0.75, 0.45])
fine = noise(N, 128) * 0.3 + noise(N, 64) * 0.2
col = orange[None, None] * (1 - m[..., None]) + cream[None, None] * m[..., None]
col = np.clip(col * (0.85 + 0.3 * fine[..., None]), 0, 1)
fur = noise(N, 200) * 0.6 + noise(N, 100) * 0.4
gx = np.gradient(fur, axis=1) * 14; gy = np.gradient(fur, axis=0) * 14
nm = np.dstack([0.5 - gx, 0.5 - gy, np.ones_like(fur)]); nm /= np.linalg.norm(nm - 0.5 * 0 , axis=2, keepdims=True) / 1.0
nm = np.dstack([0.5 + (nm[..., 0] - 0.5) * 0.5, 0.5 + (nm[..., 1] - 0.5) * 0.5, np.ones_like(fur)])
rough = np.clip(0.55 + fur * 0.35, 0, 1)

def img(name, arr, cs):
    import zlib, struct
    a = np.clip(arr, 0, 1)
    if a.ndim == 2: a = np.dstack([a] * 3)
    a = (a * 255 + 0.5).astype(np.uint8)
    raw = b"".join(b"\x00" + a[y].tobytes() for y in range(N))
    def ck(t, d): c = struct.pack(">I", len(d)) + t + d; return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    path = os.path.join(SCR, name + ".png")
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + ck(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 2, 0, 0, 0)) + ck(b"IDAT", zlib.compress(raw, 9)) + ck(b"IEND", b""))
    im = bpy.data.images.load(path); im.name = name + "_f"; im.colorspace_settings.name = cs; im.pack(); return im
ic = img("fur_col", col, "sRGB"); inm = img("fur_nrm", nm, "Non-Color")
ir = img("fur_mr", np.dstack([np.zeros((N, N)), rough, np.zeros((N, N))]), "Non-Color")

def mat(name, **kw):
    mt = bpy.data.materials.new(name); mt.use_nodes = True
    b = mt.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return mt, b
def tex(mt, im, out_socket, inp, extra=None):
    t = mt.node_tree.nodes.new("ShaderNodeTexImage"); t.image = im
    return t
fm, fb = mat("Fur", **{"Sheen Weight": 0.6, "Sheen Roughness": 0.4, "Specular IOR Level": 0.3})
nt = fm.node_tree; L = nt.links
t1 = nt.nodes.new("ShaderNodeTexImage"); t1.image = ic; L.new(t1.outputs["Color"], fb.inputs["Base Color"])
t2 = nt.nodes.new("ShaderNodeTexImage"); t2.image = inm; nn = nt.nodes.new("ShaderNodeNormalMap"); nn.inputs["Strength"].default_value = 0.25
L.new(t2.outputs["Color"], nn.inputs["Color"]); L.new(nn.outputs["Normal"], fb.inputs["Normal"])
t3 = nt.nodes.new("ShaderNodeTexImage"); t3.image = ir; sp = nt.nodes.new("ShaderNodeSeparateColor")
L.new(t3.outputs["Color"], sp.inputs["Color"]); L.new(sp.outputs["Green"], fb.inputs["Roughness"])
glass, gb = mat("Visor", **{"Base Color": (0.05, 0.25, 0.4, 1), "Roughness": 0.05, "Metallic": 0.0, "Alpha": 0.35, "Transmission Weight": 0.0})
glass.blend_method = "BLEND" if hasattr(glass, "blend_method") else None
metal, _ = mat("Nozzle", **{"Base Color": (0.35, 0.36, 0.4, 1), "Metallic": 1.0, "Roughness": 0.3})
flame, flb = mat("FlameMat", **{"Base Color": (1, 0.5, 0.1, 1), "Emission Color": (1.0, 0.45, 0.08, 1), "Emission Strength": 6.0, "Roughness": 0.5})
pink, _ = mat("Pink", **{"Base Color": (1.0, 0.55, 0.6, 1), "Roughness": 0.6})
whisk, _ = mat("Whisker", **{"Base Color": (0.95, 0.93, 0.85, 1), "Roughness": 0.4})

def fin(o, name, mt):
    o.name = name; o.data.name = name
    if mt: o.data.materials.append(mt)
    for p in o.data.polygons: p.use_smooth = True
    return o
def ell(name, c, r, mt, seg=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=c)
    o = bpy.context.object; o.scale = r; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); return fin(o, name, mt)
def cone(name, c, r1, r2, d, mt, rot=(0, math.pi / 2, 0), v=32):
    bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r1, radius2=r2, depth=d, location=c, rotation=rot)
    o = bpy.context.object; bpy.ops.object.transform_apply(rotation=True); return fin(o, name, mt)

body = ell("Body", (-0.03, 0, 0.1), (0.14, 0.085, 0.075), fm)
head = ell("Head", (0.125, 0, 0.125), (0.09, 0.08, 0.07), fm)
earL = cone("EarL", (0.115, 0.05, 0.205), 0.03, 0.0, 0.07, fm, rot=(0, 0.1, 0), v=24)
earR = cone("EarR", (0.115, -0.05, 0.205), 0.03, 0.0, 0.07, fm, rot=(0, 0.1, 0), v=24)
fins = [ell("FinL", (-0.02, 0.1, 0.07), (0.07, 0.035, 0.012), fm, 32, (0.5, 0, 0.35)),
        ell("FinR", (-0.02, -0.1, 0.07), (0.07, 0.035, 0.012), fm, 32, (-0.5, 0, -0.35))]
nose = ell("Nose", (0.208, 0, 0.12), (0.012, 0.014, 0.01), pink, 16)
visor = ell("Visor", (0.145, 0, 0.15), (0.07, 0.075, 0.06), glass, 32)
nozzle = cone("Nozzle", (-0.165, 0, 0.1), 0.05, 0.04, 0.05, metal)          # tail = engine
FLAME_ORIGIN = (-0.19, 0, 0.1)
bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.04, radius2=0.0, depth=0.05, location=(-0.215, 0, 0.1), rotation=(0, -math.pi / 2, 0))
fl = bpy.context.object; bpy.ops.object.transform_apply(rotation=True); fin(fl, "Flame", flame)
bpy.context.scene.cursor.location = FLAME_ORIGIN; bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
for o in (body, head, nozzle, fl): pass
whiskers = []
for s in (1, -1):
    for i, (dz, ay) in enumerate(((0.012, 0.35), (0.0, 0.0), (-0.012, -0.35))):
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0012, depth=0.09, location=(0.19, s * 0.075, 0.115 + dz), rotation=(math.pi / 2 + s * 0.2, 0, 0))
        w = bpy.context.object; w.rotation_euler = (math.pi / 2, 0, s * (0.6 + ay * 0.5)); bpy.ops.object.transform_apply(rotation=True)
        whiskers.append(fin(w, "Whisker%s%d" % ("L" if s > 0 else "R", i), whisk))
# bring whiskers to originate at the cheeks
for w in whiskers:
    s = 1 if w.location.y > 0 else -1
# print mesh: single voxel-remeshed shell
bpy.ops.object.select_all(action="DESELECT")
dups = []
for o in [body, head, earL, earR, nozzle] + fins:
    d = o.copy(); d.data = o.data.copy(); bpy.context.collection.objects.link(d); dups.append(d)
bpy.context.view_layer.objects.active = dups[0]
for d in dups: d.select_set(True)
bpy.ops.object.join(); pr = bpy.context.object; pr.name = "PrintShell"
pr.data.materials.clear()
# add thick flame stub so engine is part of the print
pr.modifiers.new("rm", "REMESH"); pr.modifiers["rm"].mode = "VOXEL"; pr.modifiers["rm"].voxel_size = 0.003; pr.modifiers["rm"].adaptivity = 0.0
bpy.ops.object.modifier_apply(modifier="rm")
bm = bmesh.new(); bm.from_mesh(pr.data)
open_e = sum(1 for e in bm.edges if not e.is_manifold)
bm.faces.index_update()
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
# split check
bpy.ops.mesh.separate(type="LOOSE") if False else None
pr.scale = (0.3 * 1000,) * 3; bpy.ops.object.transform_apply(scale=True)   # mm, 0.3 print scale => ~132 mm long
bpy.ops.object.select_all(action="DESELECT"); pr.select_set(True)
bpy.context.view_layer.objects.active = pr
bpy.ops.wm.stl_export(filepath=STL, export_selected_objects=True)
dim = pr.dimensions.copy()
print("ISLANDS", isl); print("PRINT open_edges=%d vol=%.6g dims_mm=%s tris=%d" % (open_e, vol, tuple(round(x, 1) for x in dim), len(pr.data.polygons) * 2))
bpy.data.objects.remove(pr)

# --- glb: parent to Colby empty, centre origin
bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.name = "Colby"
allo = [o for o in bpy.data.objects if o.type == "MESH"]
lo = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in allo)
for o in allo: o.parent = root
root.location.z = -lo      # sits on y>=0 in glTF
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
# --- preview
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
if os.environ.get("COLBY_WB"):
    sc.render.engine = "BLENDER_WORKBENCH"; sc.display.shading.color_type = "TEXTURE"; sc.display.shading.light = "STUDIO"
sc.render.resolution_x, sc.render.resolution_y = 1000, 560
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.04, 0.045, 0.07, 1); sc.world = w
for loc, e in (((0.6, -0.6, 0.7), 60), ((-0.5, 0.5, 0.4), 25)):
    bpy.ops.object.light_add(type="AREA", location=loc); l = bpy.context.object; l.data.energy = e; l.data.size = 0.6
    l.rotation_euler = (math.radians(60), 0, math.radians(45))
bpy.ops.object.camera_add(location=(0.35, -0.55, 0.38)); cam = bpy.context.object
cam.location = (-0.2, -0.6, 0.35)
d = (cam.location * -1 + __import__("mathutils").Vector((0, 0, 0.1))); cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); sc.camera = cam
cam.data.lens = 38
sc.render.filepath = os.environ.get('COLBY_OUT', PREV); bpy.ops.render.render(write_still=True)
print("DONE")
