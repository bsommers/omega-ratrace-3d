# Arena (floor + rail walls) and Mouse Hole (giant cheese block with arch) for Omega Ratrace 3D.
# Usage: blender -b -P tools/blender/arena.py -- [arena mousehole|all] [--preview]
# Output: assets/models/{arena,mousehole}.glb, assets/print/*.stl (mm), assets/textures/*.png (<=1024), out/previews/*.png
# Y-up metres, origin centred, floor top surface at y=0. Deterministic (fixed seeds).
import bpy, bmesh, math, os, sys, json, random
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import props as P  # shared helpers (fnoise, normal_from_height, export_glb/export_stl, reset, boolean, bbox)

ROOT, TEXD = P.ROOT, os.path.join(P.ROOT, 'assets', 'textures')
os.makedirs(TEXD, exist_ok=True)
S = 0.02
AW, AH = 800 * S, 450 * S          # 16 x 9 m
BW, BD = (610 - 190) * S, (320 - 130) * S  # 8.4 x 3.8 m
BH = 0.9
WALL_H, WALL_T = 0.5, 0.3
TILE = 2.0  # metres per floor texture tile


def save_tex(name, rgb, color=False):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    a = np.ones((h, w, 4), np.float32)
    a[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(a.ravel())
    img.filepath_raw = os.path.join(TEXD, name + '.png')
    img.file_format = 'PNG'
    img.save()
    if not color:
        img.colorspace_settings.name = 'Non-Color'
    img.pack()
    return img


def panel_masks(n, k):
    """Checker mask (1=cheese) and seam mask for k x k panels per tile."""
    u = (np.arange(n) / n * k)[None, :] * np.ones((n, 1))
    v = (np.arange(n) / n * k)[:, None] * np.ones((1, n))
    chk = ((np.floor(u) + np.floor(v)) % 2).astype(np.float32)
    fu, fv = u % 1, v % 1
    d = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))
    seam = np.clip(1 - d / 0.025, 0, 1)
    return chk, seam, d


def floor_textures(n=1024):
    """Dark polished stone deck: 4x4 panels per 2 m tile, thin cheese-gold inlay frames in checker panels, neon guide lines on tile edges."""
    chk, seam, d = panel_masks(n, 4)
    u = (np.arange(n) / n * 4)[None, :] * np.ones((n, 1))
    v = (np.arange(n) / n * 4)[:, None] * np.ones((1, n))
    fu, fv = u % 1, v % 1
    dd = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))   # distance to panel edge (0..0.5)
    veins = P.fnoise(n, 12, 4, 11)
    blot = P.fnoise(n, 6, 6, 12)
    fine = P.fnoise(n, 120, 3, 13)
    pores = P.fnoise(n, 70, 70, 14)
    stone = np.array([0.11, 0.10, 0.135], np.float32) * (0.7 + 0.55 * blot + 0.35 * veins + 0.2 * fine)[..., None]
    # inlay: thin gold frame inset 0.09 panel units, only in checker panels
    frame = ((dd > 0.09) & (dd < 0.105)).astype(np.float32) * chk
    holes = ((pores > 0.9) & (dd > 0.15)).astype(np.float32) * chk
    gold = np.array([0.30, 0.19, 0.04], np.float32) * (0.8 + 0.3 * blot)[..., None]
    alb = stone * (1 - frame[..., None]) + gold * frame[..., None]
    alb = alb * (1 - 0.6 * holes[..., None]) * (1 - 0.7 * seam[..., None] * 0.6)
    # neon guide line along tile edges (u,v wrap at tile edge)
    tu, tv = np.arange(n)[None, :] / n, np.arange(n)[:, None] / n
    te = np.minimum(np.minimum(tu, 1 - tu), np.minimum(tv, 1 - tv)) * np.ones((n, n))
    line = np.clip(1 - te / 0.006, 0, 1).astype(np.float32)
    glow = np.clip(1 - te / 0.03, 0, 1) ** 2 * 0.12
    neon = np.array([0.1, 0.8, 1.0], np.float32)
    emis = neon * (line + glow)[..., None] * 0.28
    alb = alb * (1 - line[..., None]) + neon * 0.2 * line[..., None]
    h = fine * 0.15 - 1.0 * seam - 0.4 * frame - 0.5 * holes
    nrm = P.normal_from_height(h, 4)
    rough = np.clip(0.14 + 0.35 * blot * blot + 0.22 * fine + 0.25 * frame + 0.3 * seam, 0.08, 0.9)
    mr = np.stack([np.zeros_like(rough), rough, 0.15 + 0.7 * frame], -1)  # G=roughness B=metallic (gold inlay metallic)
    return (save_tex('arena_floor_albedo', alb, True), save_tex('arena_floor_normal', nrm),
            save_tex('arena_floor_mr', mr), save_tex('arena_floor_emissive', emis, True))


def wall_textures(n=1024, hgt=256):
    scr = P.fnoise(n, 300, 2, 21)[:hgt]
    blot = P.fnoise(n, 8, 8, 22)[:hgt]
    v = (np.arange(hgt) / hgt)[:, None] * np.ones((1, n))      # 0 = top of image
    u = (np.arange(n) / n)[None, :] * np.ones((hgt, 1))
    strip = ((v > 0.38) & (v < 0.52)).astype(np.float32)
    glow = np.clip(1 - np.abs(v - 0.45) / 0.07, 0, 1) * 0.35
    metal = np.array([0.5, 0.52, 0.58], np.float32) * (0.75 + 0.3 * blot + 0.2 * scr)[..., None]
    groove = ((v > 0.34) & (v < 0.56)).astype(np.float32)
    alb = metal * (1 - 0.7 * groove[..., None]) + np.array([0.02, 0.05, 0.06]) * groove[..., None]
    rivet = (np.hypot((u * 16 % 1) - 0.5, ((v * 4) % 1) * 1.0 - 0.5) < 0.12).astype(np.float32) * ((v < 0.2) | (v > 0.7))
    alb = alb * (1 - 0.4 * rivet[..., None])
    neon = np.array([0.1, 0.95, 1.0], np.float32)
    seg = ((u * 8) % 1 < 0.5).astype(np.float32)
    col = neon * (1 - seg[..., None]) + np.array([1.0, 0.45, 0.08], np.float32) * seg[..., None]
    emis = col * (strip + glow)[..., None]
    alb = alb * (1 - strip[..., None]) + col * 0.3 * strip[..., None]
    h = scr * 0.4 - 0.8 * groove + 0.5 * strip + 0.6 * rivet
    nrm = P.normal_from_height(h, 5)
    rough = np.clip(0.3 + 0.25 * scr + 0.3 * groove, 0, 1) * (1 - 0.6 * strip)
    mr = np.stack([np.zeros_like(rough), rough, np.ones_like(rough) * (1 - strip)], -1)
    return (save_tex('arena_wall_albedo', alb, True), save_tex('arena_wall_normal', nrm),
            save_tex('arena_wall_mr', mr), save_tex('arena_wall_emissive', emis, True))


def cheese_textures(n=1024):
    t = P.fnoise(n, 5, 5, 31) + 0.5 * P.fnoise(n, 12, 12, 32)
    m = np.clip((np.sin(t * 8.0) + 1) * 0.5, 0, 1)[..., None]   # Colby Jack marble
    orange = np.array([0.95, 0.45, 0.07], np.float32)
    cream = np.array([0.99, 0.88, 0.58], np.float32)
    fine = P.fnoise(n, 90, 90, 33)
    alb = (orange * m + cream * (1 - m)) * (0.62 + 0.18 * fine)[..., None]
    h = 0.5 * P.fnoise(n, 40, 40, 34) + 0.3 * fine + 0.2 * m[..., 0]
    nrm = P.normal_from_height(h, 3)
    return save_tex('mousehole_cheese_albedo', alb, True), save_tex('mousehole_cheese_normal', nrm)


# ------------------------------------------------------------ materials
def mat_pbr(name, alb, nrm, mr=None, emis=None, rough=0.6, nstr=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0

    def tex(img):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        return t
    nt.links.new(tex(alb).outputs['Color'], b.inputs['Base Color'])
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = nstr
    nt.links.new(tex(nrm).outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if mr is not None:
        sp = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tex(mr).outputs['Color'], sp.inputs['Color'])
        nt.links.new(sp.outputs['Green'], b.inputs['Roughness'])
        nt.links.new(sp.outputs['Blue'], b.inputs['Metallic'])
    if emis is not None:
        nt.links.new(tex(emis).outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = 1.0
    return m


# ------------------------------------------------------------ geometry
def box(name, center, size, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(center)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        me.materials.append(mat)
    return ob


def box_uv(ob, su, sv_y, sv_z=None):
    """Planar UVs by dominant normal axis in world metres. u scale 1/su; v for vertical faces uses 1/sv_y."""
    sv_z = sv_z or su
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co
            if ax == 1:
                u, v = c.x / su, c.z / sv_z
            elif ax == 0:
                u, v = c.z / su, 1.0 - c.y / sv_y
            else:
                u, v = c.x / su, 1.0 - c.y / sv_y
            l[uv].uv = (u, v)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False


def smooth_shade(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


# ------------------------------------------------------------ builders
def build_arena():
    P.reset()
    fa, fn, fm, fe = floor_textures()
    wa, wn, wm, we = wall_textures()
    floor_m = mat_pbr('ArenaFloorMat', fa, fn, fm, fe, nstr=0.8)
    wall_m = mat_pbr('ArenaRailMat', wa, wn, wm, we, nstr=0.9)
    fl = box('ArenaFloor', (0, -0.1, 0), (AW, 0.2, AH), floor_m)
    box_uv(fl, TILE, 0.2, TILE)
    # rail walls sit just outside the 16x9 play area; vertical UV: image height (256px) = 0.5 m, 1024px = 2 m
    walls = []
    hw, hh = AW / 2, AH / 2
    for nm, c, sz in (('RailNorth', (0, WALL_H / 2, -hh - WALL_T / 2), (AW + 2 * WALL_T, WALL_H, WALL_T)),
                      ('RailSouth', (0, WALL_H / 2, hh + WALL_T / 2), (AW + 2 * WALL_T, WALL_H, WALL_T)),
                      ('RailWest', (-hw - WALL_T / 2, WALL_H / 2, 0), (WALL_T, WALL_H, AH)),
                      ('RailEast', (hw + WALL_T / 2, WALL_H / 2, 0), (WALL_T, WALL_H, AH))):
        w = box(nm, c, sz, wall_m)
        box_uv(w, TILE, WALL_H, TILE)
        walls.append(w)
    return 200.0


def build_mousehole():
    ca, cn = cheese_textures()
    cheese_m = mat_pbr('MouseHoleCheeseMat', ca, cn, None, rough=0.5, nstr=1.0)
    dark_m = P.material('MouseHoleDark', color=(0.01, 0.008, 0.01), rough=0.9)
    blk = box('MouseHoleBlock', (0, BH / 2, 0), (BW, BH, BD), cheese_m, bevel=0.05)
    rng = random.Random(7)
    placed = []
    tries = 0
    while len(placed) < 16 and tries < 400:
        tries += 1
        face = rng.choice(['top', 'top', 'front', 'back', 'left', 'right'])
        r = rng.uniform(0.06, 0.16)
        if face == 'top':
            c = (rng.uniform(-BW / 2 + 0.6, BW / 2 - 0.6), BH, rng.uniform(-BD / 2 + 0.5, BD / 2 - 0.5))
        elif face in ('front', 'back'):
            c = (rng.uniform(-BW / 2 + 0.6, BW / 2 - 0.6), rng.uniform(0.2, BH - 0.2), (BD / 2 if face == 'front' else -BD / 2))
            if abs(c[0]) < 1.0 and c[1] < 0.9:
                continue
        else:
            c = ((BW / 2 if face == 'right' else -BW / 2), rng.uniform(0.2, BH - 0.2), rng.uniform(-BD / 2 + 0.5, BD / 2 - 0.5))
        if any((Vector(c) - Vector(p[0])).length < r + p[1] + 0.25 for p in placed):
            continue
        placed.append((c, r))
    for i, (c, r) in enumerate(placed):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        me = bpy.data.meshes.new('h%d' % i)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new('h%d' % i, me)
        bpy.context.scene.collection.objects.link(o)
        o.location = c
        P.boolean(blk, o)
    # arch tunnel through the block along Z (enemies emerge from either face)
    AR = 0.4
    arch_w, arch_wall = AR * 2, 0.4
    cut = box('cut', (0, arch_wall / 2 - 0.01, 0), (arch_w, arch_wall + 0.02, BD + 1), None)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=AR, radius2=AR, depth=BD + 1)
    c2 = bpy.data.meshes.new('cut2')
    bm.to_mesh(c2)
    bm.free()
    cy = bpy.data.objects.new('cut2', c2)
    bpy.context.scene.collection.objects.link(cy)
    cy.location = (0, arch_wall, 0)       # cone axis is Z already
    P.boolean(blk, cut)
    P.boolean(blk, cy)
    box_uv(blk, TILE, BH, TILE)
    # dark backdrop plate inside the tunnel (visual only, excluded from STL by 'Shadow' prefix)
    box('ShadowPlate', (0, arch_wall / 2, 0), (arch_w - 0.02, arch_wall, 0.06), dark_m)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=AR - 0.01, radius2=AR - 0.01, depth=0.06)
    c3 = bpy.data.meshes.new('ShadowPlateTop')
    bm.to_mesh(c3)
    bm.free()
    c3.materials.append(dark_m)
    po = bpy.data.objects.new('ShadowPlateTop', c3)
    bpy.context.scene.collection.objects.link(po)
    po.location = (0, arch_wall, 0)
    return 168.0


BUILDERS = {'arena': build_arena, 'mousehole': build_mousehole}


def preview(name, cam=(0.55, 0.62, 1.0), dist=1.9, extra_sun=True):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.render.filepath = os.path.join(P.PREV, name + '.png')
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.2, 0.22, 0.28, 1)
    sc.world = w
    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = 3.0
    so = bpy.data.objects.new('sun', ld)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    lo, hi = P.bbox([o for o in sc.objects if o.type == 'MESH'])
    ctr = (lo + hi) / 2
    c = bpy.data.cameras.new('c')
    c.lens = 40
    co = bpy.data.objects.new('c', c)
    sc.collection.objects.link(co)
    co.location = ctr + Vector(cam).normalized() * max(hi - lo) * dist
    co.rotation_euler = (ctr - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    bpy.ops.render.render(write_still=True)


def run(names, do_preview):
    infos = []
    P.ground = lambda: None  # arena floor top is at y=0; do not lift
    for n in names:
        P.reset()
        mm = BUILDERS[n]()
        if n == 'mousehole':
            pass
        path, tris, root = P.export_glb(n)
        info = P.export_stl(n, mm, skip=('Shadow',), voxel_mm=0.5)
        info.update(glb=os.path.relpath(path, ROOT), glb_tris=tris)
        print('RESULT', json.dumps(info))
        infos.append(info)
        if do_preview:
            if n == 'arena':
                P.reset()
                build_arena()
                build_mousehole()
                preview('arena')
            else:
                P.reset()
                build_mousehole()
                preview('mousehole', cam=(0.25, 0.3, 1.0), dist=1.5)
    return infos


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in argv if not a.startswith('--')]
    if not names or names == ['all']:
        names = list(BUILDERS)
    run(names, '--preview' in argv)
