# -*- coding: utf-8 -*-
# cat.glb 뼈대로 누운 자세 두 개(배 보이기·옆으로 눕기)를 잡아 렌더하고, 뼈대·자세만 cat-poses.glb로 내보낸다
# 실행 (저장소 루트에서):
#   Blender -b --python tools/blender/poses.py -- <미리보기 경로 접두어> [내보낼 glb 경로]
#   예) /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/poses.py -- /tmp/pose web/public/assets/models/cat-poses.glb
#   미리보기: <접두어>_<자세>_{side,front,top}.png. glb 경로를 주지 않으면 렌더만 한다.
# 자세를 바꾸려면 아래 belly()·side()의 rot(뼈, 축, 각도)를 고친다. 축 F·U·L = 고양이 기준 앞·위·왼쪽
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from posekit import *
args = sys.argv[sys.argv.index('--') + 1:]
PREVIEW, OUT = args[0], (args[1] if len(args) > 1 else None)
arm = load(); rest(arm); cat_frame(arm)
F, U, L = A(1, 0, 0), A(0, 1, 0), A(0, 0, 1)
FRONT = (('L', 'leg.upper.F.L_014', 'leg.lower.FL_015', 'foot.F.L_016'), ('R', 'leg.upper.F.R_024', 'leg.lower.F.R_00', 'foot.F.R_025'))
BACK = (('L', 'thigh.B.L_03', 'leg.upper.B.L_04', 'leg.lower.B.L_05', 'foot.B.L_06'), ('R', 'thigh.B.R_026', 'leg.upper.B.R_027', 'leg.lower.B.R_028', 'foot.B.R_029'))
# 자세에 넣는 뼈 (꼬리·귀·눈·입은 코드가 계속 움직인다)
KEYED = ['torso_02', 'spine.01_012', 'spine.02_013', 'neck_017', 'head_018'] + [b for f in FRONT for b in f[1:]] + [b for f in BACK for b in f[1:]]

def belly(arm):
    rot(arm, 'torso_02', F, 160)            # 등을 대고 뒤집기 (살짝 옆으로)
    rot(arm, 'spine.01_012', U, 10)          # 몸을 C자로
    rot(arm, 'spine.02_013', U, 10)
    rot(arm, 'neck_017', F, -35)             # 머리는 거꾸로 하늘을 보며 살짝 옆으로
    rot(arm, 'head_018', L, -20)
    for s, up, lo, ft in FRONT:
        rot(arm, up, L, -55)                 # 앞발: 가슴 쪽으로 오므리기
        rot(arm, lo, L, 80)
        rot(arm, ft, L, 60)
    for s, th, up, lo, ft in BACK:
        sg = 1 if s == 'L' else -1
        rot(arm, th, F, 45 * sg)             # 뒷다리: 무릎을 바깥으로 벌리기 (개구리 다리)
        rot(arm, up, L, -10)
        rot(arm, lo, L, 70)
        rot(arm, ft, L, -30)

def side(arm):
    rot(arm, 'torso_02', F, 88)             # 오른쪽 옆구리를 바닥에 대고 눕기
    rot(arm, 'spine.01_012', U, 8)           # 몸을 살짝 둥글게
    rot(arm, 'spine.02_013', U, 8)
    rot(arm, 'neck_017', L, -10)             # 머리는 옆으로 뉘어 바닥에 기대기
    rot(arm, 'head_018', F, 8)
    for s, up, lo, ft in FRONT:
        top = s == 'L'                       # 위쪽 다리는 바닥 쪽으로 조금 처진다
        rot(arm, up, L, 35)                  # 앞다리: 앞으로 뻗고 팔꿈치는 살짝 굽힘
        rot(arm, lo, L, -25)
        rot(arm, ft, L, 20)
        if top: rot(arm, up, F, 12)
    for s, th, up, lo, ft in BACK:
        top = s == 'L'
        rot(arm, up, L, -30)                 # 뒷다리: 뒤로 뻗고 무릎은 살짝 굽힘
        rot(arm, lo, L, 30)
        rot(arm, ft, L, -20)
        if top: rot(arm, th, F, 12)

# 다리는 aim()으로 옆에서 본 뼈 방향(도: 0 앞, -90 아래, ±180 뒤)을 정한다. 뼈 순서는 위에서 아래로
LOAF_FRONT = (-150, -8, 0)          # 팔꿈치는 뒤로 낮게, 앞발은 가슴 밑에서 앞으로 접음
LOAF_BACK = (-35, -150, -5, 0)      # 허벅지 앞으로, 정강이 뒤로, 발등은 바닥을 따라 앞으로
NAP_FRONT = (-45, -12, -4)          # 앞다리를 앞으로 뻗어 바닥에

def legs(arm, front, back):
    for s, up, lo, ft in FRONT:
        aim(arm, (up, lo, ft), front)
    for s, th, up, lo, ft in BACK:
        aim(arm, (th, up, lo, ft), back)

def loaf(arm):
    # 식빵: 몸은 수평으로 낮게, 앞발은 가슴 밑으로 접어 넣고, 뒷다리는 엉덩이 밑에 접는다
    rot(arm, 'neck_017', L, 12)
    rot(arm, 'head_018', L, -8)
    legs(arm, LOAF_FRONT, LOAF_BACK)

def nap(arm):
    # 낮잠: 엎드려 앞발을 앞으로 뻗고, 그 위에 고개를 숙여 기댄다. 몸은 살짝 옆으로 기울임
    legs(arm, NAP_FRONT, LOAF_BACK)
    rot(arm, 'neck_017', L, 30)
    rot(arm, 'head_018', L, 15)
    rot(arm, 'head_018', F, -10)
    rot(arm, 'torso_02', F, 12)

def tailwrap(arm):
    # 꼬리 감고 엎드리기: 몸을 둥글게 말고 머리를 꼬리 쪽으로 돌려 묻는다 (꼬리는 코드가 감는다)
    legs(arm, LOAF_FRONT, LOAF_BACK)
    rot(arm, 'spine.01_012', U, 18)
    rot(arm, 'spine.02_013', U, 18)
    rot(arm, 'neck_017', U, 25)
    rot(arm, 'neck_017', L, 25)
    rot(arm, 'head_018', L, 20)
    rot(arm, 'torso_02', F, 14)

# 이름 = 게임의 자세 값 이름 (web/src/cat/liePoses.ts LIE_POSES와 같아야 한다)
POSES = [('bellyUp', belly), ('sideLie', side), ('loafPose', loaf), ('napPose', nap), ('wrapPose', tailwrap)]
ONLY = os.environ.get('POSES')
if ONLY: POSES = [x for x in POSES if x[0] in ONLY.split(',')]
for name, fn in POSES:
    rest(arm); fn(arm)
    render(f'{PREVIEW}_{name}', VIEWS)
    if OUT:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        if not arm.animation_data: arm.animation_data_create()
        arm.animation_data.action = act
        key(arm, KEYED, 0)
        key(arm, KEYED, 1)
        arm.animation_data.action = None

if OUT:
    rest(arm)
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    for name, _ in POSES:
        tr = arm.animation_data.nla_tracks.new(); tr.name = name
        tr.strips.new(name, 0, bpy.data.actions[name])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_yup=True, export_skins=False, export_force_sampling=True, export_rest_position_armature=True)
    print('EXPORTED', OUT)
