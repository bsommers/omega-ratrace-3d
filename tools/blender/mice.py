# Mouse / rat / commander / deathrat builders for Omega Ratrace 3D.
# Usage: blender -b -P tools/blender/mice.py -- [mouse rat commander deathrat|all] [--preview]
# Forward = +X, Y up, metres, y>=0, origin at body centre on the floor. R = KINDS[k].r * WORLD_SCALE (body bounding radius).
import bpy, math, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import props as P
from props import ellipsoid, tube, material, make_tex, cylinder

KINDS = dict(  # r from src/core/defs.js
    mouse=dict(r=10, fur=(0.62, 0.58, 0.70), skin=(0.95, 0.55, 0.62), eye=(0.01, 0.01, 0.015), snout=1.0, ear=1.0, stl=80),
    rat=dict(r=12, fur=(0.42, 0.38, 0.47), skin=(0.78, 0.50, 0.55), eye=(0.01, 0.01, 0.015), snout=1.25, ear=0.85, stl=90),
    commander=dict(r=15, fur=(0.42, 0.38, 0.47), skin=(0.78, 0.50, 0.55), eye=(0.01, 0.01, 0.015), snout=1.25, ear=0.85, stl=100),
    deathrat=dict(r=18, fur=(0.05, 0.045, 0.055), skin=(0.25, 0.12, 0.14), eye=(1.0, 0.03, 0.02), snout=1.35, ear=0.8, stl=110),
)


def build(kind):
    k = KINDS[kind]
    R = k['r'] * P.WS
    fur = material('Fur', make_tex('fur_' + kind, 'fur', k['fur'], 11), rough=0.8, sheen=1.0)
    skin = material('Skin', make_tex('skin_' + kind, 'skin', k['skin'], 12), rough=0.5)
    dead = kind == 'deathrat'
    eye = material('EyeGloss', color=k['eye'], rough=0.04, coat=1.0,
                   emit=(1, 0.05, 0.03) if dead else None, emit_strength=6.0 if dead else 0.0)
    teeth = material('Teeth', color=(0.95, 0.92, 0.8), rough=0.4)
    sn = k['snout']
    # body (bean), haunch, belly
    ellipsoid('Body', (-0.08 * R, 0.42 * R, 0), (0.56 * R, 0.40 * R, 0.38 * R), fur)
    ellipsoid('Haunch', (-0.32 * R, 0.36 * R, 0), (0.34 * R, 0.34 * R, 0.40 * R), fur)
    # head + snout
    ellipsoid('Head', (0.50 * R, 0.46 * R, 0), (0.32 * R, 0.27 * R, 0.25 * R), fur)
    ellipsoid('Snout', (0.50 * R + 0.30 * R * sn, 0.40 * R, 0), (0.20 * R * sn, 0.12 * R, 0.12 * R), fur, 24, 12)
    tipx = 0.50 * R + 0.30 * R * sn + 0.19 * R * sn
    ellipsoid('Nose', (tipx, 0.40 * R, 0), (0.05 * R, 0.05 * R, 0.055 * R), skin, 16, 8)
    # ears (pink inner, fur rim)
    e = k['ear']
    for side, nm in ((1, 'EarL'), (-1, 'EarR')):
        ellipsoid(nm, (0.40 * R, 0.76 * R, side * 0.22 * R), (0.06 * R, 0.19 * R * e, 0.16 * R * e), skin, 24, 12,
                  rot=(side * 0.35, side * 0.3, 0))
    # eyes
    for side, nm in ((1, 'EyeL'), (-1, 'EyeR')):
        ellipsoid(nm, (0.66 * R, 0.55 * R, side * 0.16 * R), 0.055 * R, eye, 20, 10)
    # incisors
    for side, nm in ((1, 'ToothL'), (-1, 'ToothR')):
        ellipsoid(nm, (tipx - 0.03 * R, 0.30 * R, side * 0.02 * R), (0.015 * R, 0.05 * R, 0.012 * R), teeth, 8, 6)
    # feet
    for x, z, nm in ((0.28, 0.22, 'FootFL'), (0.28, -0.22, 'FootFR'), (-0.40, 0.28, 'FootBL'), (-0.40, -0.28, 'FootBR')):
        ellipsoid(nm, (x * R, 0.06 * R, z * R), (0.14 * R, 0.07 * R, 0.07 * R), skin, 12, 8)
    # tail (pink, tapering). Thick enough to print (>=2 mm dia at print scale).
    tube('Tail', [(-0.55 * R, 0.30 * R, 0), (-0.95 * R, 0.16 * R, 0.15 * R), (-1.35 * R, 0.10 * R, -0.12 * R),
                  (-1.7 * R, 0.07 * R, 0.1 * R)], 0.06 * R, skin, taper=True, end=0.55)
    # whiskers (not printed)
    wm = material('Whisker', color=(0.9, 0.9, 0.92), rough=0.4)
    for side, sn_ in ((1, 'L'), (-1, 'R')):
        for i, dy in enumerate((0.04, 0.0, -0.04)):
            ang = (i - 1) * 0.25
            x0 = tipx - 0.12 * R
            tube('Whisker%s%d' % (sn_, i), [(x0, 0.42 * R + dy * R, side * 0.05 * R),
                 (x0 - 0.05 * R, 0.44 * R + dy * R * 2, side * 0.28 * R),
                 (x0 - 0.2 * R, 0.43 * R + dy * R * 3 + ang * 0.05 * R, side * 0.5 * R)], 0.006 * R, wm, taper=True, res=4, bevel_res=2)
    if kind == 'commander':
        gold = material('Gold', color=(0.95, 0.72, 0.15), rough=0.25, metal=1.0)
        for side, nm in ((1, 'EpauletL'), (-1, 'EpauletR')):
            ellipsoid(nm, (0.18 * R, 0.68 * R, side * 0.27 * R), (0.17 * R, 0.035 * R, 0.10 * R), gold, 24, 10,
                      rot=(side * 0.45, 0, 0))
            for j in range(3):  # fringe
                ellipsoid('%sFringe%d' % (nm, j), (0.18 * R + (j - 1) * 0.09 * R, 0.62 * R, side * 0.33 * R), 0.022 * R, gold, 8, 6)
        chee = material('BadgeCheese', make_tex('badge', 'cheese', (1.0, 0.82, 0.2), 61), rough=0.4)
        # cheese-wedge badge on the chest (side-on triangular prism, 3 corner spheres + hull via cone)
        cylinder('Badge', (0.30 * R, 0.52 * R, 0.275 * R), 0.09 * R, 0.03 * R, chee, seg=3,
                 rot=(math.pi / 2, 0, 0))
        cylinder('BadgeR', (0.30 * R, 0.52 * R, -0.275 * R), 0.09 * R, 0.03 * R, chee, seg=3, rot=(math.pi / 2, 0, 0))
    return k['stl'], (0.8, 0.45, 1.0)


def run(names, do_preview):
    out = []
    for n in names:
        P.reset()
        mm, cam = build(n)
        path, tris, _ = P.export_glb(n)
        info = P.export_stl(n, mm, skip=('Whisker', 'EpauletLFringe', 'EpauletRFringe'), voxel_mm=0.6)
        info.update(glb=os.path.relpath(path, P.ROOT), glb_tris=tris)
        if do_preview:
            P.preview(n, cam=cam)
        print('RESULT', json.dumps(info))
        out.append(info)
    return out


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = [a for a in argv if not a.startswith('--')]
    if not names or names == ['all']:
        names = list(KINDS)
    run(names, '--preview' in argv)
