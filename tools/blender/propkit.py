# -*- coding: utf-8 -*-
# 소품 모델을 코드로 만드는 도구 (Blender 5.4 명령줄). 지금 소품(Polyfork)과 같은 방식:
# 미터 단위, 바닥 0, 정점 색(COLOR_0, 선형 색)으로 칠하고 재질은 둘(vc 보통, glow 빛나는 부분).
# Blender 축: X 오른쪽, -Y 정면, Z 위 → glb에서는 +Z가 정면, Y가 위.
import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS_DIR = os.path.join(ROOT, 'web', 'public', 'assets', 'models')
PROPS_DIR = os.path.join(MODELS_DIR, 'props')
MAT = {}


def lin(h):
    """#rrggbb(sRGB) → 선형 색 (정점 색은 선형으로 저장된다)"""
    h = h.lstrip('#')
    def f(i):
        v = int(h[i:i + 2], 16) / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(0), f(2), f(4), 1.0)


def M(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return (Matrix.Translation(Vector(loc)) @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
            @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0)))


def aim(p0, p1):
    """로컬 +Z가 p0 → p1을 향하는 행렬과 길이"""
    d = Vector(p1) - Vector(p0)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return Matrix.Translation(Vector(p0)) @ q.to_matrix().to_4x4(), d.length


class Mesh:
    def __init__(self, name, seed=1, smooth=False):
        self.name = name
        self.bm = bmesh.new()
        self.layer = self.bm.loops.layers.float_color.new('Color')
        self.rng = random.Random(seed)
        self.smooth = smooth

    # ── 내부 ──
    def _paint(self, faces, c, glow=False):
        col = lin(c)
        for f in faces:
            f.material_index = 1 if glow else 0
            f.smooth = self.smooth
            for l in f.loops:
                l[self.layer] = col

    def _faces(self, verts):
        s = set()
        for v in verts:
            s.update(v.link_faces)
        return list(s)

    def _place(self, verts, m):
        bmesh.ops.transform(self.bm, matrix=m, verts=verts)

    # ── 기본 도형 (loc은 바닥 가운데) ──
    def box(self, c, size, loc, rot=(0, 0, 0), glow=False, jit=0.0):
        vs = bmesh.ops.create_cube(self.bm, size=1.0)['verts']
        if jit:
            for v in vs:
                v.co += Vector((self.rng.uniform(-jit, jit), self.rng.uniform(-jit, jit), self.rng.uniform(-jit, jit)))
        sx, sy, sz = size
        self._place(vs, M(loc, rot) @ Matrix.Translation((0, 0, sz / 2)) @ Matrix.Diagonal((sx, sy, sz, 1)))
        fs = self._faces(vs)
        self._paint(fs, c, glow)
        return fs

    def cyl(self, c, r1, r2, h, loc=(0, 0, 0), rot=(0, 0, 0), seg=8, glow=False, capc=None, m=None):
        """원기둥·원뿔대 (r1 아래, r2 위). m을 주면 loc·rot 대신 그 행렬 (로컬 +Z 방향으로 선다)"""
        vs = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)['verts']
        fs = self._faces(vs)
        caps = []
        if capc:
            for f in fs:
                f.normal_update()
                if abs(f.normal.z) > 0.9:
                    caps.append(f)
        self._place(vs, (m if m is not None else M(loc, rot)) @ Matrix.Translation((0, 0, h / 2)))
        self._paint(fs, c, glow)
        if caps:
            self._paint(caps, capc, glow)
        return fs

    def rod(self, c, p0, p1, r1, r2=None, seg=6, glow=False, capc=None):
        """p0에서 p1까지 가는 막대"""
        m, L = aim(p0, p1)
        return self.cyl(c, r1, r1 if r2 is None else r2, L, seg=seg, glow=glow, capc=capc, m=m)

    def ball(self, c, r, loc, scale=(1, 1, 1), sub=1, glow=False, flat=False, jit=0.0, rot=(0, 0, 0)):
        """정이십면체 공. flat이면 아래 절반을 눌러 바닥에 붙는 둔덕, jit은 울퉁불퉁한 정도(반지름 대비)"""
        vs = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0)['verts']
        for v in vs:
            if jit:
                v.co *= 1 + self.rng.uniform(-jit, jit)
            if flat and v.co.z < 0:
                v.co.z = 0
        self._place(vs, M(loc, rot) @ Matrix.Diagonal((r * scale[0], r * scale[1], r * scale[2], 1)))
        fs = self._faces(vs)
        self._paint(fs, c, glow)
        return fs

    def uv(self, c, r, loc, scale=(1, 1, 1), u=10, v=7, glow=False, rot=(0, 0, 0)):
        vs = bmesh.ops.create_uvsphere(self.bm, u_segments=u, v_segments=v, radius=1.0)['verts']
        self._place(vs, M(loc, rot) @ Matrix.Diagonal((r * scale[0], r * scale[1], r * scale[2], 1)))
        fs = self._faces(vs)
        self._paint(fs, c, glow)
        return fs

    def torus(self, c, R, r, loc, rot=(0, 0, 0), seg=12, tube=6, glow=False, scale=(1, 1, 1)):
        grid = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring = []
            for j in range(tube):
                b = 2 * math.pi * j / tube
                ring.append(self.bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
            grid.append(ring)
        fs = []
        for i in range(seg):
            for j in range(tube):
                i2, j2 = (i + 1) % seg, (j + 1) % tube
                fs.append(self.bm.faces.new((grid[i][j], grid[i2][j], grid[i2][j2], grid[i][j2])))
        self._place([v for ring in grid for v in ring], M(loc, rot, scale))
        self._paint(fs, c, glow)
        return fs

    def pipe(self, c, pts, r, seg=6, glow=False, caps=True):
        """점들을 따라가는 관. c·r은 하나 또는 목록(구간·점마다)"""
        pts = [Vector(p) for p in pts]
        n = len(pts)
        rs = list(r) if isinstance(r, (list, tuple)) else [r] * n
        cs = list(c) if isinstance(c, (list, tuple)) else [c]
        tang = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
        ref = Vector((0, 0, 1)) if abs(tang[0].z) < 0.9 else Vector((1, 0, 0))
        nrm = (ref - tang[0] * ref.dot(tang[0])).normalized()
        rings = []
        for i in range(n):
            t = tang[i]
            nrm = (nrm - t * nrm.dot(t)).normalized()
            b = t.cross(nrm)
            rings.append([self.bm.verts.new(pts[i] + (nrm * math.cos(2 * math.pi * j / seg) + b * math.sin(2 * math.pi * j / seg)) * rs[i]) for j in range(seg)])
        faces = []
        for i in range(n - 1):
            fs = []
            for j in range(seg):
                k = (j + 1) % seg
                fs.append(self.bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j])))
            self._paint(fs, cs[i % len(cs)], glow)
            faces += fs
        if caps:
            f0 = self.bm.faces.new(list(reversed(rings[0])))
            f1 = self.bm.faces.new(rings[-1])
            self._paint([f0], cs[0], glow)
            self._paint([f1], cs[(n - 2) % len(cs)], glow)
            faces += [f0, f1]
        return faces

    def loft(self, c, rings, seg=10, cap=True, glow=False, phase=0.0, m=None):
        """타원 단면 (cx, cy, z, rx, ry)을 이어 붙인 몸통. 돌려주는 값: (면, 단면마다 정점)"""
        cs = list(c) if isinstance(c, (list, tuple)) else [c]
        vr = []
        for (cx, cy, z, rx, ry) in rings:
            vr.append([self.bm.verts.new((cx + rx * math.cos(phase + 2 * math.pi * j / seg), cy + ry * math.sin(phase + 2 * math.pi * j / seg), z)) for j in range(seg)])
        faces = []
        for i in range(len(vr) - 1):
            fs = []
            for j in range(seg):
                k = (j + 1) % seg
                fs.append(self.bm.faces.new((vr[i][j], vr[i][k], vr[i + 1][k], vr[i + 1][j])))
            self._paint(fs, cs[i % len(cs)], glow)
            faces += fs
        if cap:
            f0 = self.bm.faces.new(list(reversed(vr[0])))
            f1 = self.bm.faces.new(vr[-1])
            self._paint([f0], cs[0], glow)
            self._paint([f1], cs[(len(vr) - 2) % len(cs)], glow)
            faces += [f0, f1]
        if m is not None:
            self._place([v for ring in vr for v in ring], m)
        return faces, vr

    def limb(self, c, p0, p1, radii, seg=10):
        """p0 → p1로 가며 굵기가 변하는 팔다리"""
        m, L = aim(p0, p1)
        n = len(radii)
        return self.loft(c, [(0, 0, L * i / (n - 1), r, r) for i, r in enumerate(radii)], seg=seg, m=m)

    def prism(self, c, pts, depth, loc=(0, 0, 0), rot=(0, 0, 0), glow=False):
        """XZ 평면의 다각형(pts)을 Y로 depth만큼 민 기둥 (박공 벽 등)"""
        a = [self.bm.verts.new((x, -depth / 2, z)) for x, z in pts]
        b = [self.bm.verts.new((x, depth / 2, z)) for x, z in pts]
        fs = [self.bm.faces.new(a), self.bm.faces.new(list(reversed(b)))]
        n = len(pts)
        for i in range(n):
            k = (i + 1) % n
            fs.append(self.bm.faces.new((a[i], b[i], b[k], a[k])))
        self._place(a + b, M(loc, rot))
        self._paint(fs, c, glow)
        return fs

    def star(self, c, R, r, t, loc, rot=(0, 0, 0), glow=True):
        """정면(-Y)을 보는 다섯 꼭지 별"""
        rim = []
        for i in range(10):
            a = math.pi / 2 + 2 * math.pi * i / 10
            q = R if i % 2 == 0 else r
            rim.append(self.bm.verts.new((q * math.cos(a), 0, q * math.sin(a))))
        f = self.bm.verts.new((0, -t, 0))
        b = self.bm.verts.new((0, t, 0))
        fs = []
        for i in range(10):
            k = (i + 1) % 10
            fs.append(self.bm.faces.new((f, rim[i], rim[k])))
            fs.append(self.bm.faces.new((b, rim[k], rim[i])))
        self._place(rim + [f, b], M(loc, rot))
        self._paint(fs, c, glow)
        return fs

    def finish(self, loc=(0, 0, 0)):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        me.materials.append(MAT['vc'])
        me.materials.append(MAT['glow'])
        ca = me.color_attributes.get('Color')
        if ca is not None:
            me.color_attributes.active_color = ca
            try:
                me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
            except Exception:
                pass
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = loc
        return ob


def make_mat(name, glow):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs[0], out.inputs[0])
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Color'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    if glow:
        bsdf.inputs['Emission Color'].default_value = (1, 1, 1, 1)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return mat


def setup():
    """빈 장면, 재질, 미리보기 렌더 설정"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MAT['vc'] = make_mat('vc', False)
    MAT['glow'] = make_mat('glow', True)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    sh = scn.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'VERTEX'
    sh.show_shadows = True
    sh.shadow_intensity = 0.3
    sh.show_cavity = True
    try:
        sh.background_type = 'VIEWPORT'
        sh.background_color = (0.62, 0.70, 0.84)
    except Exception as e:
        print('background:', e)
    try:
        scn.display.render_aa = '8'
        scn.view_settings.view_transform = 'Standard'
    except Exception as e:
        print('view:', e)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 50
    cam = bpy.data.objects.new('cam', cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    return scn


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi, pts


def metrics(objs):
    """크기·삼각형 수와, 게임이 원점으로 삼는 자리(바닥에 닿는 아래 5%의 가운데, bakeModel과 같은 규칙)"""
    lo, hi, pts = bounds(objs)
    low = lo.z + 0.05 * (hi.z - lo.z)
    base = [p for p in pts if p.z <= low]
    bx = (min(p.x for p in base) + max(p.x for p in base)) / 2
    by = (min(p.y for p in base) + max(p.y for p in base)) / 2
    tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
    r = lambda v: round(v, 3)
    return {'width': r(hi.x - lo.x), 'depth': r(hi.y - lo.y), 'height': r(hi.z - lo.z), 'minZ': r(lo.z), 'tris': tris,
            'bakeOrigin': [r(bx), r(by)], 'bbox': [[r(lo.x), r(lo.y), r(lo.z)], [r(hi.x), r(hi.y), r(hi.z)]]}


def export(objs, path):
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        if o is not None:
            o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_animations=False)
    for extra in ({'export_vertex_color': 'MATERIAL'}, {'export_vertex_color': 'ACTIVE'}, {}):
        try:
            bpy.ops.export_scene.gltf(**kw, **extra)
            return
        except TypeError as e:
            print('export retry:', extra, e)
    raise RuntimeError('glb 내보내기 실패: ' + path)


def scale_cat(x, y):
    """크기 비교용 고양이 (어깨 높이 약 0.25m, 내보내지 않음)"""
    m = Mesh('scale-cat', 3)
    o = '#e39a4f'
    m.box(o, (0.13, 0.36, 0.13), (x, y, 0.12))
    for sx in (-0.045, 0.045):
        for sy in (-0.13, 0.13):
            m.box(o, (0.035, 0.04, 0.12), (x + sx, y + sy, 0))
    m.ball(o, 0.085, (x, y - 0.21, 0.27), sub=2)
    for sx in (-0.045, 0.045):
        m.cyl(o, 0.03, 0.003, 0.07, (x + sx, y - 0.2, 0.33), seg=4)
    m.rod(o, (x, y + 0.18, 0.2), (x, y + 0.3, 0.42), 0.02, 0.012)
    return m.finish()


def shoot(objs, path, direction=(0.75, -1.0, 0.5), res=(480, 480), zoom=1.0, center=None, size=None):
    scn = bpy.context.scene
    lo, hi, _ = bounds(objs)
    c = Vector(center) if center else (lo + hi) / 2
    s = size if size else (hi - lo).length
    cam = scn.camera
    cam.location = c + Vector(direction).normalized() * s * 1.5 * zoom
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_start = 0.01
    cam.data.clip_end = 500
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = 'PNG'
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)


def floor():
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    return bpy.context.object


def clear():
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            me = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if me.users == 0:
                bpy.data.meshes.remove(me)
    bpy.context.view_layer.update()
