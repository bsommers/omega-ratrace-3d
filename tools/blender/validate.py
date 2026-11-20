"""Headless STL validator. Usage: blender -b -P validate.py -- <printDir> <out.json>
Per STL: shells, manifold (non-manifold edges), volume, bbox (mm), min-wall estimate."""
import sys, os, json, struct, glob

def read_stl(path):
    data = open(path, 'rb').read()
    tris = []
    if len(data) >= 84 and 84 + struct.unpack('<I', data[80:84])[0] * 50 == len(data):
        n = struct.unpack('<I', data[80:84])[0]
        for i in range(n):
            o = 84 + i * 50
            v = struct.unpack('<12f', data[o:o + 48])
            tris.append((v[3:6], v[6:9], v[9:12]))
    else:
        vs = []
        for line in data.decode('ascii', 'ignore').splitlines():
            p = line.split()
            if len(p) == 4 and p[0] == 'vertex':
                vs.append(tuple(map(float, p[1:])))
        tris = [tuple(vs[i:i + 3]) for i in range(0, len(vs) - 2, 3)]
    return tris

def main():
    import bmesh
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    argv = sys.argv[sys.argv.index('--') + 1:]
    pdir, out = argv[0], argv[1]
    res = {}
    for path in sorted(glob.glob(os.path.join(pdir, '*.stl'))):
        name = os.path.splitext(os.path.basename(path))[0]
        r = {'ok': False, 'errors': []}
        try:
            tris = read_stl(path)
            bm = bmesh.new()
            for t in tris:
                try:
                    bm.faces.new([bm.verts.new(v) for v in t])
                except ValueError:
                    pass
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
            bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.faces.ensure_lookup_table()
            bm.normal_update()
            nm = sum(1 for e in bm.edges if not e.is_manifold)
            # shells via union-find flood
            seen, shells = set(), 0
            for v in bm.verts:
                if v.index in seen: continue
                shells += 1
                stack = [v]; seen.add(v.index)
                while stack:
                    c = stack.pop()
                    for e in c.link_edges:
                        o = e.other_vert(c)
                        if o.index not in seen:
                            seen.add(o.index); stack.append(o)
            vol = bm.calc_volume(signed=True)
            xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
            bbox = [round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(max(zs) - min(zs), 3)]
            # min wall: raycast inward from sampled face centres
            bvh = BVHTree.FromBMesh(bm)
            step = max(1, len(bm.faces) // 3000)
            ds = []
            for f in list(bm.faces)[::step]:
                c = f.calc_center_median(); n = f.normal
                if n.length == 0: continue
                hit = bvh.ray_cast(c - n * 1e-3, -n)
                if hit[0] is not None: ds.append(hit[3])
            ds.sort()
            wall = round(ds[max(0, int(len(ds) * 0.02))], 3) if ds else None
            r.update(faces=len(bm.faces), verts=len(bm.verts), shells=shells, nonManifoldEdges=nm,
                     volumeMm3=round(vol, 2), bboxMm=bbox, minWallMm=wall)
            if shells != 1: r['errors'].append('shells=%d' % shells)
            if nm: r['errors'].append('nonmanifold_edges=%d' % nm)
            if vol <= 0: r['errors'].append('volume<=0')
            if wall is not None and wall < 1.2: r['errors'].append('min_wall<1.2mm (%s)' % wall)
            r['ok'] = not r['errors']
            bm.free()
        except Exception as ex:
            r['errors'].append('exception: %s' % ex)
        res[name] = r
    json.dump(res, open(out, 'w'), indent=1)

main()
