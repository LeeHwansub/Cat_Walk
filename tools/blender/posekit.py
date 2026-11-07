# -*- coding: utf-8 -*-
# cat.glb 뼈대로 자세를 잡는 도구. 축은 기준 자세의 뼈 위치에서 계산한 고양이 기준 F(앞)·U(위)·L(왼쪽)
import bpy, math, os, sys
from mathutils import Matrix, Vector, Quaternion

# 저장소 기준 경로 (이 파일: tools/blender/posekit.py)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CAT = os.path.join(ROOT, 'web', 'public', 'assets', 'models', 'cat.glb')

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CAT, guess_original_bind_pose=False, bone_heuristic='TEMPERANCE')
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    # 모델에 든 걷기 동작이 기준 자세를 덮지 않게 동작 연결을 지운다
    for o in bpy.data.objects:
        o.animation_data_clear()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
        pb.scale = Vector((1, 1, 1))
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    bpy.context.evaluated_depsgraph_get().update()
    return arm

def rest(arm):
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    bpy.context.view_layer.update()

FRAME = {}

def cat_frame(arm):
    """기준 자세에서 고양이 기준 축 (아마추어 공간): F 앞, U 위, L 왼쪽"""
    t = head_of(arm, 'torso_02'); h = head_of(arm, 'neck_017')
    feet = (head_of(arm, 'foot.F.L_016') + head_of(arm, 'foot.F.R_025')) / 2
    U = (head_of(arm, 'leg.upper.F.L_014') + head_of(arm, 'leg.upper.F.R_024')) / 2 - feet
    U.normalize()
    F = (h - t); F = (F - U * F.dot(U)).normalized()
    L = (head_of(arm, 'leg.upper.F.L_014') - head_of(arm, 'leg.upper.F.R_024'))
    L = (L - U * L.dot(U) - F * L.dot(F)).normalized()
    FRAME.update(F=F, U=U, L=L)
    return FRAME

def A(*w):
    """고양이 기준 축 조합 → 아마추어 공간 방향. A(f, u, l)"""
    f, u, l = w
    return (FRAME['F'] * f + FRAME['U'] * u + FRAME['L'] * l).normalized()

def P(arm, name):
    return arm.pose.bones[name]

def head_of(arm, name):
    return P(arm, name).matrix.translation.copy()

def rot(arm, name, axis, deg):
    """뼈를 아마추어 공간 축(axis) 둘레로 deg도 돌린다 (뼈 머리 기준, 자식도 함께)"""
    pb = P(arm, name)
    M = pb.matrix.copy()
    h = M.translation.copy()
    R = Matrix.Rotation(math.radians(deg), 4, Vector(axis).normalized())
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M
    bpy.context.view_layer.update()

def axis_of(arm, name, local=(0, 1, 0)):
    """뼈의 로컬 축을 아마추어 공간 방향으로"""
    return (P(arm, name).matrix.to_3x3() @ Vector(local)).normalized()

def key(arm, names, frame):
    for n in names:
        P(arm, n).keyframe_insert('rotation_quaternion', frame=frame)

def arm_obj():
    return [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

def mesh_obj():
    return [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Icosphere'][0]

def render(path, views):
    """views: [(name, cam_dir, up)] — 메시 둘레에서 cam_dir 쪽으로 떨어져서 본다"""
    import bmesh
    me = mesh_obj()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = me.evaluated_get(dg)
    pts = [ev.matrix_world @ v.co for v in ev.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    c = (lo + hi) / 2
    size = max(hi - lo)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'TEXTURE'
    scn.render.resolution_x = 480
    scn.render.resolution_y = 360
    for o in bpy.data.objects:
        if o.name == 'Icosphere': o.hide_render = True
    # 바닥 (가장 낮은 점)
    Uw = (W0 := arm_obj().matrix_world.to_3x3().normalized()) @ FRAME['U']
    low = min(p.dot(Uw) for p in pts)
    bpy.ops.mesh.primitive_plane_add(size=size * 6)
    floor = bpy.context.object
    floor.matrix_world = (Uw.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    floor.location = c + Uw * (low - c.dot(Uw))
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 35
    cam_data.clip_start = size * 0.01
    cam_data.clip_end = size * 50
    cam = bpy.data.objects.new('cam', cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    out = []
    W = arm_obj().matrix_world.to_3x3().normalized()
    for name, d, up in views:
        d = (W @ A(*d)).normalized()
        up = (W @ A(*up)).normalized()
        cam.location = c + d * size * ZOOM[0]
        z = d
        x = Vector(up).cross(z).normalized()
        y = z.cross(x)
        m = Matrix((x, y, z)).transposed().to_4x4()
        m.translation = cam.location
        cam.matrix_world = m
        scn.render.filepath = f'{path}_{name}.png'
        bpy.ops.render.render(write_still=True)
        out.append(scn.render.filepath)
    bpy.data.objects.remove(floor)
    print('SIZE', round(size, 3))
    return out

# (이름, 카메라 방향 (앞, 위, 왼쪽), 화면 위 방향)
ZOOM = [1.5]
VIEWS = [('side', (0.15, 0.35, 1), (0, 1, 0)), ('front', (1, 0.5, 0.25), (0, 1, 0)), ('top', (0.3, 1, 0.25), (1, 0, 0))]
