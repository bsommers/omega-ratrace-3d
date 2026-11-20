# Shared Blender helpers + prop builders (mine, tuna, yarn, hairball) for Omega Ratrace 3D.
# Usage: blender -b -P tools/blender/props.py -- [mine tuna yarn hairball|all] [--preview]
# Output: assets/models/<n>.glb (Y-up, metres, nose/forward +X, y>=0), assets/print/<n>.stl (mm, single shell).
# Deterministic: fixed seeds only.
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
MODELS = os.path.join(ROOT, 'assets', 'models')
PRINT = os.path.join(ROOT, 'assets', 'print')
TEX = os.path.join(ROOT, 'out', 'tex')
PREV = os.path.join(ROOT, 'out', 'previews')
WS = 0.02  # defs.WORLD_SCALE
for d in (MODELS, PRINT, TEX, PREV):
    os.makedirs(d, exist_ok=True)


# ------------------------------------------------------------ textures
def fnoise(n, fx, fy=None, seed=0):
    fy = fx if fy is None else fy
    w = np.random.default_rng(seed).standard_normal((n, n))
    kx = np.fft.fftfreq(n)[None, :] * n
    ky = np.fft.fftfreq(n)[:, None] * n
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * np.exp(-((kx / fx) ** 2 + (ky / fy) ** 2))))
    r -= r.min()
    return r / max(r.max(), 1e-9)


def _save(name, rgb, noncolor=False):
    n = rgb.shape[0]
    path = os.path.join(TEX, name + '.png')
    img = bpy.data.images.new(name, n, n, alpha=False)
    a = np.ones((n, n, 4), np.float32)
    a[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(a.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    if noncolor:
        img.colorspace_settings.name = 'Non-Color'
    img.pack()
    return img


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nrm = np.stack([-dx, -dy, np.ones_like(h)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    return nrm * 0.5 + 0.5


def make_tex(name, kind, tint, seed=1, n=512):
    """Baked procedural albedo (tint already multiplied in) + normal map. Returns (albedo, normal|None)."""
    tint = np.array(tint[:3], np.float32)
    if kind == 'fur':
        s = fnoise(n, 110, 7, seed) * 0.6 + fnoise(n, 170, 15, seed + 1) * 0.4
        cl = fnoise(n, 10, 10, seed + 2)
        alb = tint * (0.6 + 0.7 * s * (0.6 + 0.4 * cl))[..., None]
        return _save(name + '_a', alb), _save(name + '_n', normal_from_height(s, 5), True)
    if kind == 'skin':
        c = fnoise(n, 70, 70, seed)
        alb = tint * (0.85 + 0.3 * fnoise(n, 12, 12, seed + 1) - 0.1 * (c > 0.72))[..., None]
        return _save(name + '_a', alb), _save(name + '_n', normal_from_height(c, 2), True)
    if kind == 'cheese':
        m = fnoise(n, 7, 7, seed)
        alb = tint * (0.82 + 0.35 * m + 0.08 * fnoise(n, 90, 90, seed + 1))[..., None]
        return _save(name + '_a', alb), _save(name + '_n', normal_from_height(fnoise(n, 60, 60, seed + 2), 1.5), True)
    if kind == 'metal':
        sc = fnoise(n, 220, 3, seed)
        alb = tint * (0.8 + 0.3 * fnoise(n, 6, 6, seed + 1) - 0.15 * (sc > 0.75))[..., None]
        return _save(name + '_a', alb), _save(name + '_n', normal_from_height(sc, 1.2), True)
    if kind == 'yarn':  # marbled orange / cream (Colby Jack) with twisted-strand ridges
        t = fnoise(n, 5, 5, seed) + 0.5 * fnoise(n, 14, 14, seed + 1)
        m = np.clip((np.sin(t * 9.0) + 1) * 0.5, 0, 1)[..., None]
        orange = np.array([0.93, 0.42, 0.06], np.float32)
        cream = np.array([0.98, 0.9, 0.68], np.float32)
        u = np.arange(n)[None, :] / n
        v = np.arange(n)[:, None] / n
        ridge = 0.5 + 0.5 * np.sin(2 * np.pi * (u * 48 + v * 20))
        alb = (orange * m + cream * (1 - m)) * (0.82 + 0.18 * ridge)[..., None]
        return _save(name + '_a', alb), _save(name + '_n', normal_from_height(ridge, 2.5), True)
    return _save(name + '_a', np.broadcast_to(tint, (8, 8, 3)).copy()), None


# ------------------------------------------------------------ materials
def material(name, tex=None, color=(0.8, 0.8, 0.8), rough=0.6, metal=0.0, emit=None, emit_strength=0.0,
             coat=0.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color[:3], 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if coat and 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (*emit[:3], 1)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    if tex:
        alb, nrm = tex
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = alb
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        if nrm is not None:
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = nrm
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nm.inputs['Strength'].default_value = 0.6
            nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return m


# ------------------------------------------------------------ geometry
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _finish(ob, mat, name, smooth=True):
    ob.name = name
    ob.data.name = name
    if mat is not None:
        ob.data.materials.append(mat)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def ellipsoid(name, c, r, mat, seg=32, rings=16, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.scale = r if hasattr(r, '__len__') else (r, r, r)
    ob.rotation_euler = rot
    ob.location = c
    return _finish(ob, mat, name)


def cylinder(name, c, radius, depth, mat, seg=48, rot=(0, 0, 0), smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=radius, radius2=radius, depth=depth)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))  # bmesh cone axis Z -> Y
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = c
    ob.rotation_euler = rot
    return _finish(ob, mat, name, smooth)


def tube(name, pts, radius, mat, taper=True, res=6, bevel_res=4, end=0.25):
    """Bevelled curve through pts -> mesh with end caps."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY' if len(pts) < 3 else 'NURBS')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
        if taper:
            sp.points[i].radius = 1.0 - (1.0 - end) * i / max(1, len(pts) - 1)
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(pts))
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    ob.select_set(False)
    if mat:
        ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def boolean(a, b, op='DIFFERENCE'):
    mod = a.modifiers.new('b', 'BOOLEAN')
    mod.operation = op
    mod.object = b
    mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = a
    bpy.ops.object.modifier_apply(modifier='b')
    bpy.data.objects.remove(b, do_unlink=True)


# ------------------------------------------------------------ export
def meshes_under(prefix_skip=()):
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith(prefix_skip)]


def ground():
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    lo, _ = bbox(objs)
    if lo.y < 0:
        for o in objs:
            o.location.y -= lo.y
        bpy.context.view_layer.update()


def export_glb(name, root_name=None):
    ground()
    objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'EMPTY')]
    root = bpy.data.objects.new(root_name or name, None)
    bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        o.select_set(True)
    path = os.path.join(MODELS, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=False,  # scene is authored Y-up already
                              
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_image_format='AUTO')
    tris = sum(len(o.data.polygons) if all(len(p.vertices) == 3 for p in o.data.polygons[:1]) else
               sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs if o.type == 'MESH')
    return path, tris, root


def bbox(objs):
    bpy.context.view_layer.update()
    for o in objs:
        o.data.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def export_stl(name, longest_mm, skip=('Whisker', 'Armed', 'Tab'), voxel_mm=0.5):
    """Join printable parts, scale to mm, voxel-remesh into ONE watertight shell, validate, write STL."""
    src = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith(skip)]
    bpy.ops.object.select_all(action='DESELECT')
    dups = []
    for o in src:
        d = o.copy()
        d.data = o.data.copy()
        d.modifiers.clear()
        bpy.context.scene.collection.objects.link(d)
        d.matrix_world = o.matrix_world.copy()
        d.data.materials.clear()
        dups.append(d)
    for d in dups:
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = 'print_' + name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lo, hi = bbox([ob])
    k = longest_mm / max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    ob.data.transform(Matrix.Scale(k, 4))
    ob.data.update()
    mod = ob.modifiers.new('rm', 'REMESH')
    mod.mode = 'VOXEL'
    mod.voxel_size = voxel_mm
    mod.adaptivity = 0.0
    bpy.ops.object.modifier_apply(modifier='rm')
    lo, hi = bbox([ob])
    ob.data.transform(Matrix.Translation((-(lo.x + hi.x) / 2, -lo.y, -(lo.z + hi.z) / 2)))
    ob.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))  # Y-up (glTF) -> Z-up (printer)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    nonman = sum(1 for e in bm.edges if not e.is_manifold)
    vol = bm.calc_volume(signed=True)
    seen, shells = set(), 0
    for v in bm.verts:
        if v in seen:
            continue
        shells += 1
        seen.add(v)
        stack = [v]
        while stack:
            for e in stack.pop().link_edges:
                for x in e.verts:
                    if x not in seen:
                        seen.add(x)
                        stack.append(x)
    bm.to_mesh(ob.data)
    bm.free()
    lo, hi = bbox([ob])
    path = os.path.join(PRINT, name + '.stl')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True, global_scale=1.0, apply_modifiers=True)
    info = dict(name=name, stl=os.path.relpath(path, ROOT), size_mm=[round(hi[i] - lo[i], 2) for i in range(3)],
                volume_mm3=round(vol, 1), non_manifold_edges=nonman, shells=shells, tris=len(ob.data.polygons),
                voxel_mm=voxel_mm)
    bpy.data.objects.remove(ob, do_unlink=True)
    return info


def preview(name, size=(640, 480), cam=None, target=(0, 0.1, 0)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.filepath = os.path.join(PREV, name + '.png')
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.17, 0.2, 1)
    sc.world = w
    for loc, e in (((2, 3, 3), 400), ((-3, 2, -2), 150)):
        L = bpy.data.lights.new('l', 'AREA')
        L.energy, L.size = e, 3
        o = bpy.data.objects.new('l', L)
        sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    lo, hi = bbox([o for o in sc.objects if o.type == 'MESH'])
    d = max(hi - lo) * 2.4
    c = bpy.data.cameras.new('c')
    c.lens = 50
    co = bpy.data.objects.new('c', c)
    sc.collection.objects.link(co)
    ctr = (lo + hi) / 2
    co.location = ctr + Vector(cam or (0.7, 0.45, 1.0)).normalized() * d
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------ props
def build_mine():
    R = 9 * WS  # 0.18 m wheel radius
    H = 0.55 * R
    tex = make_tex('cheese', 'cheese', (0.98, 0.78, 0.22), 21)
    cm = material('Cheese', tex, rough=0.45, coat=0.15)
    rind = material('Rind', make_tex('rind', 'cheese', (0.85, 0.5, 0.12), 22), rough=0.6)
    wheel = cylinder('Wheel', (0, H / 2, 0), R, H, cm, seg=64)
    rng = np.random.default_rng(7)
    holes = [(0.0, 0.0, 0.2), (0.55, 0.3, 0.16), (-0.5, 0.45, 0.2), (0.2, -0.6, 0.15), (-0.35, -0.5, 0.12), (0.7, -0.35, 0.1)]
    for i, (x, z, rr) in enumerate(holes):
        h = ellipsoid('hole%d' % i, (x * R, H / 2 + rng.uniform(-0.2, 0.5) * H, z * R), (rr * R, H * 0.62, rr * R), None, 16, 8)
        boolean(wheel, h)
    # side bites
    for i, a in enumerate((0.8, 2.5, 4.4)):
        h = ellipsoid('bite%d' % i, (math.cos(a) * R, H / 2, math.sin(a) * R), (0.16 * R, 0.3 * H, 0.16 * R), None, 16, 8)
        boolean(wheel, h)
    for p in wheel.data.polygons:
        p.use_smooth = False
    # rind band slightly proud (ring)
    ring = cylinder('Rind', (0, H / 2, 0), R * 1.01, H * 0.98, rind, seg=64)
    bm = bmesh.new()
    bm.from_mesh(ring.data)
    top = [f for f in bm.faces if abs(f.normal.y) > 0.9] if False else []
    bm.free()
    ring.hide_set(True)
    bpy.data.objects.remove(ring, do_unlink=True)
    # armed light node
    em = material('ArmedGlow', color=(1, 0.1, 0.05), rough=0.3, emit=(1, 0.12, 0.04), emit_strength=8.0)
    ellipsoid('Armed', (0, H + 0.02 * R, 0), 0.09 * R, em, 16, 8)
    return 60, (0.6, 0.6, 1.0)


def build_tuna():
    R = 9 * WS
    H = 0.42 * R
    metal = material('TinMetal', make_tex('tin', 'metal', (0.8, 0.82, 0.85), 31), rough=0.3, metal=1.0)
    lab = material('TinLabel', color=(0.1, 0.35, 0.75), rough=0.45)
    fish = material('Tuna', make_tex('fish', 'skin', (0.85, 0.45, 0.4), 32), rough=0.35)
    cylinder('TinBody', (0, H / 2, 0), R, H, metal, seg=64)
    cylinder('Label', (0, H / 2, 0), R * 1.01, H * 0.55, lab, seg=64)
    cylinder('LidRim', (0, H, 0), R * 0.97, H * 0.12, metal, seg=64)
    cylinder('TunaMeat', (0, H * 1.04, 0), R * 0.84, H * 0.1, fish, seg=48)
    cylinder('TabBase', (R * 0.3, H * 1.12, 0), R * 0.11, H * 0.06, metal, seg=24)
    t = tube('Tab', [(R * 0.1, H * 1.2, -R * 0.1), (R * 0.45, H * 1.35, 0), (R * 0.1, H * 1.2, R * 0.1)], R * 0.03, metal, taper=False)
    # fused tab: keep part of print by naming base (Tab skipped in STL; base kept)
    return 60, (0.7, 0.8, 0.9)


def build_yarn():
    R = 0.16
    ym = material('Yarn', make_tex('yarn', 'yarn', (1, 1, 1), 41), rough=0.9, sheen=1.0)
    ellipsoid('Ball', (0, R, 0), R, ym, 48, 24)
    rng = np.random.default_rng(5)
    for i in range(7):
        ax = Vector(rng.normal(size=3)).normalized()
        q = ax.to_track_quat('Z', 'Y').to_euler()
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=False, segments=48, radius=R * 1.02)
        me = bpy.data.meshes.new('lp')
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new('Strand%d' % i, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = (0, R, 0)
        ob.rotation_euler = q
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        # circle -> tube via skin-free: convert edges to curve
        bpy.ops.object.convert(target='CURVE')
        ob.data.bevel_depth = R * 0.06
        ob.data.use_fill_caps = False
        bpy.ops.object.convert(target='MESH')
        ob = bpy.context.view_layer.objects.active
        ob.data.materials.append(ym)
        ob.select_set(False)
        for p in ob.data.polygons:
            p.use_smooth = True
    tail = tube('Thread', [(R * 0.7, R * 0.9, R * 0.5), (R * 1.3, R * 0.12, R * 0.9), (R * 1.7, R * 0.06, R * 0.75), (R * 2.0, R * 0.06, R * 1.2)], R * 0.07, ym, taper=False)
    return 70, (0.7, 0.6, 1.0)


def build_hairball():
    R = 3 * WS  # 0.06
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=R)
    rng = np.random.default_rng(3)
    for v in bm.verts:
        v.co *= 1.0 + 0.22 * (rng.random() - 0.4)
    me = bpy.data.meshes.new('Hairball')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('Hairball', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (0, R, 0)
    m = material('HairGlow', make_tex('hair', 'fur', (1.0, 0.55, 0.15), 51), color=(1, 0.5, 0.1), rough=0.8,
                 emit=(1, 0.45, 0.12), emit_strength=3.0)
    _finish(ob, m, 'Hairball')
    return 30, (0.6, 0.6, 1.0)


BUILDERS = dict(mine=build_mine, tuna=build_tuna, yarn=build_yarn, hairball=build_hairball)


def run(names, do_preview):
    infos = []
    for n in names:
        reset()
        mm, cam = BUILDERS[n]()
        path, tris, root = export_glb(n)
        info = export_stl(n, mm, voxel_mm=0.4 if n == 'hairball' else 0.5)
        info.update(glb=os.path.relpath(path, ROOT), glb_tris=tris)
        if do_preview:
            preview(n, cam=cam)
        print('RESULT', json.dumps(info))
        infos.append(info)
    return infos


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in argv if not a.startswith('--')]
    if not names or names == ['all']:
        names = list(BUILDERS)
    run(names, '--preview' in argv)
