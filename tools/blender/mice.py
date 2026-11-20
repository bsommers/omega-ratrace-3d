# Mouse / rat / commander / deathrat, photoreal pass (skin-modifier sculpt + strand-card fur + PBR).
# Usage: blender -b -P tools/blender/mice.py -- [mouse rat commander deathrat|all] [--preview]
# Blender authored Z-up, nose +X (glTF exporter maps Z->Y, +X stays). Metres. Origin = body centre, floor at y=0.
# Body (nose..rump, tail excluded) length = KINDS.r * WORLD_SCALE (mouse 0.20 m). Tail is a separate "Tail" node.
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
WS = 0.02  # defs.WORLD_SCALE
KINDS = dict(  # r from src/core/defs.js; stl = longest print dimension in mm
    mouse=dict(r=10, fur=(0.55, 0.50, 0.46), skin=(0.95, 0.58, 0.62), eye=(0.01, 0.01, 0.012), snout=1.0, ear=1.0, stl=80, blades=7000),
    rat=dict(r=12, fur=(0.30, 0.27, 0.34), skin=(0.82, 0.52, 0.58), eye=(0.01, 0.01, 0.012), snout=1.2, ear=0.85, stl=90, blades=8000),
    commander=dict(r=15, fur=(0.30, 0.25, 0.40), skin=(0.82, 0.52, 0.58), eye=(0.01, 0.01, 0.012), snout=1.2, ear=0.85, stl=100, blades=9000),
    deathrat=dict(r=18, fur=(0.035, 0.032, 0.04), skin=(0.30, 0.14, 0.17), eye=(1.0, 0.03, 0.02), snout=1.3, ear=0.8, stl=110, blades=10000),
)

def mat(name, **kw):
    mt = bpy.data.materials.new(name); mt.use_nodes = True
    b = mt.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return mt
def vcol_mat(name, **kw):
    mt = mat(name, **kw); b = mt.node_tree.nodes["Principled BSDF"]
    n = mt.node_tree.nodes.new("ShaderNodeVertexColor"); n.layer_name = "Color"
    mt.node_tree.links.new(n.outputs["Color"], b.inputs["Base Color"]); return mt
def fin(o, name, mt):
    o.name = name; o.data.name = name
    if mt: o.data.materials.append(mt)
    for p in o.data.polygons: p.use_smooth = True
    return o
def ell(name, c, r, mt, seg=32, rot=(0, 0, 0)):
    if not isinstance(r, tuple): r = (r, r, r)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, location=c)
    o = bpy.context.object; o.scale = r; o.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); return fin(o, name, mt)

def skin_body(name, pts, edges, sub=3, flat=1.0):
    me = bpy.data.meshes.new(name); me.from_pydata([p[:3] for p in pts], edges, [])
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    o.modifiers.new("skin", "SKIN").use_smooth_shade = True
    for i, p in enumerate(pts):
        d = me.skin_vertices[0].data[i]; d.radius = (p[3], p[3] * flat); d.use_root = (i == 0)
    sb = o.modifiers.new("sub", "SUBSURF"); sb.levels = sb.render_levels = sub
    bpy.ops.object.modifier_apply(modifier="skin"); bpy.ops.object.modifier_apply(modifier="sub")
    for p in o.data.polygons: p.use_smooth = True
    return o

def paint(o, fn):
    me = o.data; M = o.matrix_world
    co = np.array([(M @ v.co)[:] for v in me.vertices]); c = fn(co)
    ca = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    loops = np.zeros(len(me.loops), dtype=np.int64); me.loops.foreach_get("vertex_index", loops)
    rgba = np.ones((len(loops), 4)); rgba[:, :3] = c[loops] ** 2.2
    ca.data.foreach_set("color", rgba.ravel())

def blades(src_objs, n, seed, L, fur_len, flow_fn):
    r = np.random.RandomState(seed); tris = []
    for o in src_objs:
        me = o.data; me.calc_loop_triangles(); M = o.matrix_world
        for t in me.loop_triangles:
            a, b, c = [M @ me.vertices[i].co for i in t.vertices]
            nrm = (b - a).cross(c - a); area = nrm.length * 0.5
            if area > 0: tris.append((a, b, c, nrm.normalized(), area))
    ar = np.array([t[4] for t in tris]); pick = r.choice(len(tris), size=n, p=ar / ar.sum())
    V, F = [], []
    for k in pick:
        a, b, c, nrm, _ = tris[k]; u, v = r.rand(2)
        if u + v > 1: u, v = 1 - u, 1 - v
        p = a + (b - a) * u + (c - a) * v
        flow = flow_fn(p)
        d = (nrm * (0.3 + 0.25 * r.rand()) + flow * 0.85).normalized()
        ln = fur_len * (0.7 + 0.6 * r.rand()) * (0.55 if p.x > 0.28 * L else 1.0)
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-4: side = Vector((0, 1, 0))
        side.normalize(); w = fur_len * (0.16 + 0.08 * r.rand())
        tip = p + d * ln + Vector((r.randn(), r.randn(), r.randn())) * fur_len * 0.08
        i0 = len(V); V += [p - side * w, p + side * w, tip]; F.append((i0, i0 + 1, i0 + 2))
    return V, F

def build(kind):
    k = KINDS[kind]; R = k['r'] * WS; L = R     # body length
    dead = kind == 'deathrat'; sn = k['snout']
    fcol = np.array(k['fur'])
    _r = np.random.RandomState(5); Kv = _r.randn(8, 3); Kv /= np.linalg.norm(Kv, axis=1, keepdims=True); Ph = _r.rand(8) * 6.28
    Fq = np.array([30, 55, 90, 140, 210, 300, 45, 110.0]) / L
    def fur_fn(p):
        s = np.zeros(len(p))
        for i in range(8): s += np.sin(p @ Kv[i] * Fq[i] + Ph[i]) / (i % 4 + 1.5)
        s = s / 3.0
        belly = np.clip((0.06 * L - (p[:, 2] - 0.0)) / (0.18 * L), 0, 1)[:, None]
        base = fcol[None] * (1.0 + 0.35 * s[:, None])
        light = np.clip(fcol * 1.55 + 0.05, 0, 1)[None] if not dead else fcol[None] * 1.3
        return np.clip(base * (1 - belly * 0.7) + light * belly * 0.7, 0, 1)
    fur = vcol_mat('Fur', **{"Roughness": 0.7, "Sheen Weight": 0.5, "Sheen Roughness": 0.35})
    strand = vcol_mat('FurStrand', **{"Roughness": 0.6, "Sheen Weight": 0.5, "Sheen Roughness": 0.3}); strand.use_backface_culling = False
    skin = mat('Skin', **{"Base Color": (*k['skin'], 1), "Roughness": 0.45, "Subsurface Weight": 0.25, "Subsurface Radius": (1.0, 0.3, 0.2)})
    ear_m = mat('EarTranslucent', **{"Base Color": (*[min(1, c * 1.05) for c in k['skin']], 1), "Roughness": 0.4,
                                     "Subsurface Weight": 0.6, "Subsurface Radius": (1.0, 0.25, 0.15), "Transmission Weight": 0.3, "Alpha": 0.9})
    ear_m.blend_method = "BLEND" if hasattr(ear_m, "blend_method") else None
    eye_kw = {"Base Color": (*k['eye'], 1), "Roughness": 0.02, "Coat Weight": 1.0, "Coat Roughness": 0.0}
    if dead: eye_kw.update({"Emission Color": (1, 0.05, 0.03, 1), "Emission Strength": 6.0})
    eye_m = mat('EyeGloss', **eye_kw)
    teeth = mat('Teeth', **{"Base Color": (0.95, 0.9, 0.75, 1), "Roughness": 0.35})
    wm = mat('Whisker', **{"Base Color": (0.9, 0.9, 0.92, 1), "Roughness": 0.35})
    # --- body skeleton in L units
    S = lambda x, z, y=0, r=0.1: (x * L, y * L, z * L, r * L)
    sp = [S(-0.30, .22, 0, .22), S(-0.08, .24, 0, .24), S(0.12, .22, 0, .20), S(0.26, .20, 0, .15),
          S(0.33, .20, 0, .15), S(0.43, .17, 0, .09 * sn ** .3), S(0.49 + 0.03 * (sn - 1), .15, 0, .035)]
    pts = list(sp); E = [(i, i + 1) for i in range(len(sp) - 1)]
    def leg(chain):
        i0 = len(pts)
        for q in chain: pts.append(q)
        return i0
    for s in (1, -1):
        i = leg([S(-0.26, .12, s * .16, .09), S(-0.18, .035, s * .16, .05), S(-0.08, .02, s * .15, .035)]); E += [(0, i), (i, i + 1), (i + 1, i + 2)]
        i = leg([S(0.14, .10, s * .13, .06), S(0.20, .035, s * .13, .04), S(0.27, .02, s * .12, .028)]); E += [(2, i), (i, i + 1), (i + 1, i + 2)]
    body = skin_body('Body', pts, E, sub=3)
    body.data.materials.clear(); body.data.materials.append(fur)
    head = ell('Head', (0.34 * L, 0, 0.20 * L), (0.17 * L, 0.14 * L, 0.13 * L), fur, 40)
    # tail: thin pink, tapered; separate node, excluded from body size
    tp = [(-0.22 * L, 0, 0.17 * L, 0.050 * L), (-0.40 * L, 0, 0.15 * L, 0.042 * L), (-0.70 * L, 0.04 * L, 0.10 * L, 0.034 * L), (-0.95 * L, -0.05 * L, 0.06 * L, 0.028 * L),
          (-1.18 * L, 0.05 * L, 0.06 * L, 0.024 * L), (-1.40 * L, -0.03 * L, 0.05 * L, 0.020 * L)]
    tail = skin_body('Tail', tp, [(i, i + 1) for i in range(5)], sub=2)
    tail.data.materials.clear(); tail.data.materials.append(skin)
    # ears: thin translucent discs
    ears = []
    for s, nm in ((1, 'EarL'), (-1, 'EarR')):
        e = ell(nm, (0.27 * L, s * 0.10 * L, 0.33 * L), (0.045 * L * k['ear'], 0.055 * L * k['ear'], 0.085 * L * k['ear']), ear_m, 28, rot=(s * 0.45, 0, 0.0))
        ears.append(e)
    nose = ell('Nose', (0.515 * L + 0.03 * L * (sn - 1), 0, 0.155 * L), (0.022 * L, 0.028 * L, 0.02 * L), skin, 16)
    eyes = [ell('Eye' + sn_, (0.385 * L, s * 0.112 * L, 0.238 * L), (0.036 * L, 0.034 * L, 0.036 * L), eye_m, 24) for s, sn_ in ((1, 'L'), (-1, 'R'))]
    teeth_o = [ell('Tooth' + sn_, (0.505 * L + 0.03 * L * (sn - 1), s * 0.012 * L, 0.095 * L), (0.012 * L, 0.01 * L, 0.03 * L), teeth, 8) for s, sn_ in ((1, 'L'), (-1, 'R'))]
    # fur strand cards
    flow = lambda p: Vector((-1.0, 0, -0.1)).normalized() if p.x < 0.3 * L else Vector((-0.4, 0, -0.1)).normalized()
    paint(body, fur_fn); paint(head, fur_fn)
    Vv, Ff = blades([body, head], k['blades'], 21, L, 0.075 * L, flow)
    me = bpy.data.meshes.new('FurStrands'); me.from_pydata([v[:] for v in Vv], [], Ff)
    fo = bpy.data.objects.new('FurStrands', me); bpy.context.scene.collection.objects.link(fo); me.materials.append(strand)
    col = fur_fn(np.array([v[:] for v in Vv])); ca = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    loops = np.zeros(len(me.loops), dtype=np.int64); me.loops.foreach_get("vertex_index", loops)
    tipm = (loops % 3 == 2)[:, None]; lc = col[loops]; rgba = np.ones((len(loops), 4))
    rgba[:, :3] = np.where(tipm, np.clip(lc * 1.2 + 0.015, 0, 1) ** 2.2, (lc * 0.85) ** 2.2)
    ca.data.foreach_set("color", rgba.ravel())
    # whiskers
    for s, sn_ in ((1, 'L'), (-1, 'R')):
        for i, dz in enumerate((0.03, 0.0, -0.03)):
            cu = bpy.data.curves.new('w', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0008 * (L / 0.2); cu.bevel_resolution = 1
            sp_ = cu.splines.new('BEZIER'); sp_.bezier_points.add(2)
            for bp, p in zip(sp_.bezier_points, ((0.46 * L, s * 0.03 * L, 0.16 * L + dz * L * 0.3), (0.48 * L, s * 0.14 * L, 0.17 * L + dz * L),
                                                (0.40 * L, s * 0.30 * L, 0.16 * L + dz * L * 2.2))):
                bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
            for j, bp in enumerate(sp_.bezier_points): bp.radius = (1.0, 0.7, 0.3)[j]
            o = bpy.data.objects.new('Whisker%s%d' % (sn_, i), cu); bpy.context.scene.collection.objects.link(o)
            bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH')
            o = bpy.context.object; o.data.materials.append(wm); fin(o, 'Whisker%s%d' % (sn_, i), None)
    extra = []
    if kind == 'commander':
        gold = mat('Gold', **{"Base Color": (0.95, 0.72, 0.15, 1), "Metallic": 1.0, "Roughness": 0.25})
        for s, nm in ((1, 'EpauletL'), (-1, 'EpauletR')):
            extra.append(ell(nm, (0.12 * L, s * 0.17 * L, 0.40 * L), (0.10 * L, 0.07 * L, 0.035 * L), gold, 24, rot=(s * 0.5, 0, 0)))
        chee = mat('BadgeCheese', **{"Base Color": (1.0, 0.82, 0.2, 1), "Roughness": 0.4})
        for s, nm in ((1, 'Badge'), (-1, 'BadgeR')):
            bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=0.07 * L, depth=0.03 * L, location=(0.22 * L, s * 0.19 * L, 0.20 * L), rotation=(math.pi / 2, 0, 0))
            extra.append(fin(bpy.context.object, nm, chee))
    return k, R, L, [body, head, tail] + ears + [nose] + teeth_o + extra

def export_stl(kind, k, parts, path):
    bpy.ops.object.select_all(action='DESELECT'); dups = []
    for o in parts:
        d = o.copy(); d.data = o.data.copy(); d.data.materials.clear(); bpy.context.collection.objects.link(d); dups.append(d)
    for d in dups: d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]; bpy.ops.object.join(); pr = bpy.context.object; pr.name = 'PrintShell'
    bpy.context.view_layer.update(); xs = [v.co for v in pr.data.vertices]; dm = max(max(c[i] for c in xs) - min(c[i] for c in xs) for i in range(3)); kk = k['stl'] / dm
    pr.data.transform(__import__('mathutils').Matrix.Scale(kk, 4)); pr.data.update()
    pr.modifiers.new('rm', 'REMESH'); m = pr.modifiers['rm']; m.mode = 'VOXEL'; m.voxel_size = 0.45; m.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier='rm')
    bm = bmesh.new(); bm.from_mesh(pr.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # keep largest shell
    seen = {}; comps = []
    for f in bm.faces:
        if f.index in seen: continue
        c = [f]; seen[f.index] = len(comps); st = [f]
        while st:
            cu = st.pop()
            for e in cu.edges:
                for g in e.link_faces:
                    if g.index not in seen: seen[g.index] = len(comps); st.append(g); c.append(g)
        comps.append(c)
    big = max(range(len(comps)), key=lambda i: len(comps[i]))
    drop = [f for i, c in enumerate(comps) if i != big for f in c]
    if drop: bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
    nonman = sum(1 for e in bm.edges if not e.is_manifold); vol = bm.calc_volume(signed=True)
    bm.to_mesh(pr.data); bm.free()
    bpy.context.view_layer.update(); pr.rotation_euler = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT'); pr.select_set(True); bpy.context.view_layer.objects.active = pr
    bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True)
    info = dict(shells=1, dropped_islands=len(comps) - 1, open_edges=nonman, volume_mm3=round(vol, 1), size_mm=[round(x, 1) for x in pr.dimensions], tris=len(pr.data.polygons))
    bpy.data.objects.remove(pr); return info

def run(names, do_preview):
    out = []
    for n in names:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        k, R, L, parts = build(n)
        os.makedirs(os.path.join(ROOT, 'assets/models'), exist_ok=True); os.makedirs(os.path.join(ROOT, 'assets/print'), exist_ok=True)
        info = export_stl(n, k, parts, os.path.join(ROOT, 'assets/print', n + '.stl')); info['name'] = n
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        bpy.context.view_layer.update()
        lo = min(min((o.matrix_world @ v.co).z for v in o.data.vertices) for o in meshes)
        bpy.ops.object.empty_add(location=(0, 0, 0)); root = bpy.context.object; root.name = n
        for o in meshes: o.parent = root
        root.location.z = -lo; bpy.context.view_layer.update()
        bpy.ops.object.select_all(action='SELECT')
        path = os.path.join(ROOT, 'assets/models', n + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
        info['glb_tris'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes); info['body_len_m'] = round(L, 3)
        if do_preview or True:
            sc = bpy.context.scene
            en = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
            sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in en else 'BLENDER_EEVEE'
            if hasattr(sc.eevee, 'taa_render_samples'): sc.eevee.taa_render_samples = 24
            sc.render.resolution_x, sc.render.resolution_y = 800, 520
            w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.12, 0.13, 0.17, 1); sc.world = w
            for loc, e, sz in (((0.5, -0.6, 0.8), 25, 0.5), ((-0.5, 0.4, 0.5), 10, 0.5)):
                s_ = L / 0.2
                bpy.ops.object.light_add(type='AREA', location=(loc[0] * s_ * 0.5, loc[1] * s_ * 0.5, loc[2] * s_ * 0.5)); l = bpy.context.object
                l.data.energy = e * s_ * s_ * 0.3; l.data.size = sz * s_ * 0.5; l.rotation_euler = (math.radians(60), 0, math.radians(45))
            bpy.ops.object.camera_add(location=(0.05 * L, -2.2 * L, 1.2 * L)); cam = bpy.context.object
            tgt = Vector((-0.25 * L, 0, 0.15 * L + root.location.z)); cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
            cam.data.lens = 40
            pv = os.path.join(ROOT, 'out/previews'); os.makedirs(pv, exist_ok=True)
            sc.render.filepath = os.path.join(pv, n + '.png'); bpy.ops.render.render(write_still=True)
        print('RESULT', json.dumps(info)); out.append(info)
    return out

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in argv if not a.startswith('--')]
    if not names or names == ['all']: names = list(KINDS)
    run(names, '--preview' in argv)
