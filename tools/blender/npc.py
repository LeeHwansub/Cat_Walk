# -*- coding: utf-8 -*-
# 눈 오는 광장 주민 두 명: 산타(resident-santa.glb)와 루돌프 차림 주민(resident-rudolph.glb).
# 게임이 고개와 두 팔을 움직이므로 부위를 따로 내보낸다:
#   body(다리·몸통·목), head(얼굴·머리, 모자·안경·뿔 포함, 원점 = 목 아래), armL·armR(원점 = 어깨).
# 둘 다 같은 몸·팔·얼굴 도구를 쓰고 옷·소품만 다르다. 루돌프 코는 glow 재질(밤에 빛남).
# 실행: Blender -b --python tools/blender/npc.py -- <미리보기 폴더>
import bpy, math, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, propkit
importlib.reload(propkit)
from propkit import Mesh, MODELS_DIR, ROOT

# 공통 색
SKIN, SKIN2, CHEEK = '#efc6a6', '#e2ae8c', '#e98f86'
EYE, SHINE, LIP = '#2b2420', '#fbf8f2', '#b4605a'
WHITE, FUR2 = '#f6f3ee', '#e4dfd6'
GOLD, GOLD2 = '#e2b24a', '#a87b26'
# 산타
RED, RED2, BLACK = '#c8373a', '#9e2a2e', '#272224'
# 루돌프
BROWN, BROWN2, TAN, DARK = '#8a5a3c', '#6c4430', '#d9b48a', '#3d2c24'
ANTLER, NOSE, HAIR_R = '#c9a073', '#ff2a24', '#4a3226'

CHARS = {
    'santa': {'neck': 1.40, 'shoulder': (0.205, 0.0, 1.305)},
    'rudolph': {'neck': 1.46, 'shoulder': (0.168, 0.0, 1.395)},
}


# ── 공통 도구 ──

def face(m, brow, hair_c=None, smile=True):
    """둥근 얼굴 (원점 = 목 아래, 정면 -Y). 눈 하이라이트·볼 홍조·둥근 코"""
    m.loft(SKIN, [(0, -0.01, 0.0, 0.03, 0.033), (0, -0.012, 0.016, 0.052, 0.056), (0, -0.01, 0.045, 0.072, 0.077),
                  (0, -0.006, 0.088, 0.082, 0.088), (0, -0.002, 0.13, 0.085, 0.092), (0, 0.002, 0.175, 0.082, 0.09),
                  (0, 0.004, 0.21, 0.069, 0.078), (0, 0.005, 0.234, 0.044, 0.05), (0, 0.005, 0.246, 0.014, 0.016)], seg=18)
    m.ball(SKIN2, 1.0, (0, -0.091, 0.104), scale=(0.017, 0.016, 0.017), sub=2)          # 둥근 코
    for s in (-1, 1):
        m.ball(EYE, 1.0, (s * 0.031, -0.0835, 0.134), scale=(0.0105, 0.006, 0.0128), sub=2)
        m.ball(SHINE, 1.0, (s * 0.031 + 0.004, -0.0893, 0.1385), scale=(0.0034, 0.002, 0.0034), sub=1)
        m.pipe(brow, [(s * 0.019, -0.0875, 0.155), (s * 0.031, -0.0895, 0.1605), (s * 0.044, -0.0865, 0.157)], 0.0032, seg=5)
        m.ball(CHEEK, 1.0, (s * 0.052, -0.0745, 0.094), scale=(0.018, 0.006, 0.012), sub=2)
        m.ball(SKIN2, 1.0, (s * 0.084, 0.006, 0.118), scale=(0.011, 0.02, 0.027), sub=2)  # 귀
    if smile:
        m.pipe(LIP, [(-0.02, -0.0835, 0.066), (-0.01, -0.0885, 0.059), (0.01, -0.0885, 0.059), (0.02, -0.0835, 0.066)], 0.0034, seg=5)
    if hair_c:
        # 위·뒤를 덮고 옆으로 내려오는 짧은 머리
        m.ball(hair_c, 1.0, (0, 0.022, 0.17), scale=(0.093, 0.103, 0.093), sub=2)
        m.ball(hair_c, 1.0, (0, 0.05, 0.115), scale=(0.084, 0.07, 0.088), sub=2)
        for s in (-1, 1):
            m.ball(hair_c, 1.0, (s * 0.07, 0.012, 0.155), scale=(0.024, 0.062, 0.06), sub=2)
        m.ball(hair_c, 1.0, (0.016, -0.05, 0.214), scale=(0.066, 0.032, 0.022), sub=2, rot=(-16, 0, -10))


def arm(m, side, sleeve, cuff, mitt, thick=1.0, cuff_r=0.05, length=1.0):
    """어깨(원점)에서 내려오는 팔과 벙어리장갑. side: 왼쪽 -1, 오른쪽 +1"""
    k = length
    top = (-side * 0.02, 0, 0.03)
    elbow = (side * 0.05, 0.012, -0.27 * k)
    wrist = (side * 0.058, -0.04, -0.51 * k)
    t = thick
    m.limb(sleeve, top, elbow, [0.032 * t, 0.052 * t, 0.055 * t, 0.052 * t, 0.049 * t], seg=12)
    m.ball(sleeve, 0.049 * t, elbow, sub=2)
    m.limb(sleeve, elbow, wrist, [0.049 * t, 0.047 * t, 0.043 * t], seg=12)
    m.limb(cuff, (wrist[0], wrist[1] + 0.008, wrist[2] + 0.04), (wrist[0], wrist[1] - 0.002, wrist[2] - 0.008), [cuff_r, cuff_r * 1.04, cuff_r], seg=12)
    # 벙어리장갑: 손바닥 덩어리 + 엄지
    m.ball(mitt, 1.0, (wrist[0], wrist[1] - 0.012, wrist[2] - 0.06), scale=(0.033, 0.044, 0.064), sub=2)
    m.ball(mitt, 1.0, (wrist[0] - side * 0.02, wrist[1] - 0.042, wrist[2] - 0.035), scale=(0.015, 0.017, 0.032), sub=2, rot=(28, 0, 0))


def leg(m, x, pants, rings):
    m.loft(pants, [(x * f, 0, z, rx, ry) for (f, z, rx, ry) in rings], seg=12)


def front_line(rings, z0, z1, off=0.004):
    """몸통 단면들 앞면을 따라가는 점 (털 띠)"""
    return [(0, cy - ry - off, z) for (cx, cy, z, rx, ry) in rings if z0 <= z <= z1]


# ── 산타 ──

SANTA_COAT = [(0, -0.01, 0.58, 0.215, 0.2), (0, -0.025, 0.7, 0.236, 0.226), (0, -0.036, 0.82, 0.246, 0.242),
              (0, -0.032, 0.94, 0.236, 0.228), (0, -0.016, 1.06, 0.212, 0.19), (0, -0.004, 1.17, 0.202, 0.152),
              (0, 0, 1.25, 0.198, 0.132), (0, 0, 1.31, 0.184, 0.112), (0, 0, 1.35, 0.13, 0.088),
              (0, 0, 1.375, 0.075, 0.066), (0, 0, 1.385, 0.05, 0.05)]


def santa_body():
    m = Mesh('body', 61, smooth=True)
    for s in (-1, 1):
        x = s * 0.095
        m.ball(BLACK, 1.0, (x, -0.05, 0), scale=(0.066, 0.152, 0.1), sub=2, flat=True)       # 장화 발
        m.loft(BLACK, [(x, 0, 0.05, 0.066, 0.07), (x, 0, 0.2, 0.068, 0.072), (x, 0, 0.29, 0.075, 0.078)], seg=12)
        m.torus(WHITE, 0.074, 0.02, (x, 0, 0.29), seg=14, tube=6)                             # 장화 털 테
        leg(m, x, RED, [(1.0, 0.28, 0.072, 0.076), (1.0, 0.42, 0.086, 0.09), (0.95, 0.6, 0.1, 0.104)])
    m.loft(RED, SANTA_COAT, seg=20)
    # 밑단 털, 앞섶 털 띠, 깃 털
    m.loft(WHITE, [(0, -0.01, 0.55, 0.224, 0.209), (0, -0.012, 0.6, 0.229, 0.214), (0, -0.014, 0.64, 0.226, 0.212)], seg=20)
    m.pipe(WHITE, front_line(SANTA_COAT, 0.63, 1.33, -0.014), 0.024, seg=8)
    m.torus(WHITE, 0.076, 0.03, (0, 0.002, 1.37), seg=16, tube=6, scale=(1.18, 1.05, 1.0))
    # 벨트와 금 버클
    m.loft(BLACK, [(0, -0.035, 0.84, 0.252, 0.249), (0, -0.034, 0.92, 0.246, 0.24)], seg=20, cap=False)
    m.box(GOLD, (0.08, 0.016, 0.066), (0, -0.284, 0.847))
    m.box(BLACK, (0.044, 0.018, 0.032), (0, -0.287, 0.864))
    m.box(GOLD2, (0.008, 0.02, 0.03), (0.0, -0.288, 0.864))
    # 목
    m.loft(SKIN, [(0, 0, 1.36, 0.046, 0.05), (0, 0, 1.44, 0.044, 0.047)], seg=12)
    return m.finish()


def santa_head(neck):
    m = Mesh('head', 62, smooth=True)
    face(m, WHITE, hair_c=None, smile=False)
    # 옆·뒤 흰 머리
    m.ball(WHITE, 1.0, (0, 0.05, 0.12), scale=(0.086, 0.068, 0.086), sub=2)
    for s in (-1, 1):
        m.ball(WHITE, 1.0, (s * 0.074, 0.018, 0.14), scale=(0.024, 0.055, 0.05), sub=2)
    # 수염: 턱 아래로 둥글게 + 구레나룻, 콧수염 둘
    m.ball(WHITE, 1.0, (0, -0.058, 0.05), scale=(0.088, 0.058, 0.082), sub=3)
    m.ball(WHITE, 1.0, (0, -0.07, 0.0), scale=(0.07, 0.048, 0.07), sub=2)
    m.ball(FUR2, 1.0, (0, -0.076, -0.045), scale=(0.04, 0.032, 0.04), sub=2)
    for s in (-1, 1):
        m.ball(WHITE, 1.0, (s * 0.07, -0.02, 0.085), scale=(0.024, 0.05, 0.05), sub=2)
        m.ball(WHITE, 1.0, (s * 0.021, -0.096, 0.086), scale=(0.027, 0.013, 0.013), sub=2, rot=(0, s * 18, 0))
    m.ball(LIP, 1.0, (0, -0.1, 0.07), scale=(0.011, 0.004, 0.006), sub=1)                     # 수염 사이 입
    # 동그란 금테 안경
    for s in (-1, 1):
        m.torus(GOLD, 0.019, 0.0024, (s * 0.031, -0.096, 0.134), rot=(90, 0, 0), seg=14, tube=4)
        m.pipe(GOLD, [(s * 0.05, -0.094, 0.136), (s * 0.08, -0.06, 0.135), (s * 0.086, -0.01, 0.13)], 0.002, seg=4)
    m.pipe(GOLD, [(-0.012, -0.097, 0.137), (0, -0.1, 0.14), (0.012, -0.097, 0.137)], 0.002, seg=4)
    # 산타 모자: 늘어진 원뿔 + 털 테 + 방울
    m.pipe(RED, [(0, 0.014, 0.18), (0, 0.018, 0.25), (0.012, 0.028, 0.32), (0.05, 0.04, 0.37), (0.1, 0.048, 0.385),
                 (0.145, 0.05, 0.36), (0.168, 0.05, 0.31)],
           [0.104, 0.095, 0.073, 0.05, 0.032, 0.02, 0.012], seg=14)
    m.torus(WHITE, 0.099, 0.036, (0, 0.012, 0.192), rot=(-8, 0, 0), seg=18, tube=7, scale=(1, 1.1, 1))
    m.ball(WHITE, 0.038, (0.172, 0.05, 0.285), sub=2)
    return m.finish((0, 0, neck))


def santa_arm(side, shoulder):
    m = Mesh('armR' if side > 0 else 'armL', 63 + side, smooth=True)
    arm(m, side, RED, WHITE, WHITE, thick=1.12, cuff_r=0.06, length=0.95)
    sx, sy, sz = shoulder
    return m.finish((side * sx, sy, sz))


# ── 루돌프 차림 주민 ──

RUDOLPH_COAT = [(0, 0, 0.75, 0.178, 0.128), (0, 0, 0.8, 0.176, 0.127), (0, 0, 0.92, 0.166, 0.12), (0, 0, 1.06, 0.15, 0.107),
                (0, -0.004, 1.2, 0.158, 0.115), (0, -0.004, 1.31, 0.166, 0.112), (0, 0, 1.38, 0.16, 0.099),
                (0, 0, 1.425, 0.124, 0.084), (0, 0, 1.455, 0.075, 0.068), (0, 0, 1.47, 0.05, 0.052)]


def rudolph_body():
    m = Mesh('body', 71, smooth=True)
    for s in (-1, 1):
        x = s * 0.09
        m.ball(DARK, 1.0, (x, -0.045, 0), scale=(0.062, 0.142, 0.092), sub=2, flat=True)
        m.loft(DARK, [(x, 0, 0.05, 0.058, 0.062), (x, 0, 0.16, 0.062, 0.066)], seg=12)        # 짧은 털 부츠
        m.torus(TAN, 0.062, 0.016, (x, 0, 0.165), seg=14, tube=6)
        leg(m, x, BROWN, [(1.0, 0.16, 0.058, 0.064), (1.0, 0.3, 0.056, 0.062), (1.0, 0.47, 0.06, 0.066),
                          (1.0, 0.7, 0.073, 0.081), (0.9, 0.9, 0.083, 0.091)])
    m.loft(BROWN, RUDOLPH_COAT, seg=18)
    m.loft(BROWN2, [(0, 0, 0.745, 0.182, 0.132), (0, 0, 0.785, 0.18, 0.131)], seg=18)
    # 앞판 연한 털 (가슴·배), 등 뒤로 넘긴 후드, 짧은 꼬리
    m.ball(TAN, 1.0, (0, -0.085, 1.04), scale=(0.105, 0.05, 0.27), sub=3)
    m.ball(BROWN2, 1.0, (0, 0.07, 1.4), scale=(0.11, 0.06, 0.07), sub=2)
    m.ball(TAN, 1.0, (0, 0.13, 0.84), scale=(0.04, 0.032, 0.05), sub=2)
    # 목과 방울 달린 빨간 목줄
    m.loft(SKIN, [(0, 0, 1.43, 0.046, 0.05), (0, 0, 1.5, 0.044, 0.047)], seg=12)
    m.torus(RED, 0.062, 0.016, (0, 0, 1.456), seg=16, tube=6, scale=(1.12, 1.1, 1))
    m.ball(GOLD, 0.024, (0, -0.088, 1.42), sub=2)
    m.box(GOLD2, (0.03, 0.006, 0.004), (0, -0.108, 1.412))
    return m.finish()


def rudolph_head(neck):
    m = Mesh('head', 72, smooth=True)
    face(m, HAIR_R, hair_c=HAIR_R)
    # 빛나는 빨간 코 (원래 코를 덮는다), 주근깨
    m.ball(NOSE, 0.024, (0, -0.1, 0.106), sub=2, glow=True)
    for (x, z) in ((-0.05, 0.11), (-0.06, 0.104), (-0.043, 0.101), (0.05, 0.11), (0.06, 0.104), (0.043, 0.101)):
        m.ball(BROWN2, 0.0028, (x, -0.0805, z), sub=1)
    # 머리띠 (귀에서 귀로 머리 위를 넘는다)
    band = [(math.sin(a) * 0.098, 0.006, 0.152 + math.cos(a) * 0.112) for a in [math.radians(d) for d in range(-100, 101, 20)]]
    m.pipe(DARK, band, 0.007, seg=6)
    for s in (-1, 1):
        # 사슴뿔: 줄기 하나와 가지 둘
        base = (s * 0.058, 0.008, 0.245)
        m.pipe(ANTLER, [base, (s * 0.08, 0.012, 0.3), (s * 0.104, 0.02, 0.35), (s * 0.122, 0.03, 0.392)], [0.013, 0.011, 0.009, 0.006], seg=7)
        m.pipe(ANTLER, [(s * 0.088, 0.014, 0.315), (s * 0.068, 0.0, 0.36), (s * 0.064, -0.006, 0.39)], [0.008, 0.007, 0.005], seg=6)
        m.pipe(ANTLER, [(s * 0.112, 0.024, 0.37), (s * 0.145, 0.022, 0.395), (s * 0.158, 0.02, 0.41)], [0.007, 0.006, 0.004], seg=6)
        # 사슴 귀
        m.ball(BROWN, 1.0, (s * 0.112, 0.012, 0.22), scale=(0.038, 0.011, 0.018), sub=2, rot=(0, s * 30, 0))
        m.ball(TAN, 1.0, (s * 0.113, 0.0, 0.22), scale=(0.026, 0.005, 0.011), sub=1, rot=(0, s * 30, 0))
    return m.finish((0, 0, neck))


def rudolph_arm(side, shoulder):
    m = Mesh('armR' if side > 0 else 'armL', 73 + side, smooth=True)
    arm(m, side, BROWN, TAN, DARK, thick=1.0, cuff_r=0.05)
    sx, sy, sz = shoulder
    return m.finish((side * sx, sy, sz))


def build(name):
    c = CHARS[name]
    if name == 'santa':
        return [santa_body(), santa_head(c['neck']), santa_arm(-1, c['shoulder']), santa_arm(1, c['shoulder'])]
    return [rudolph_body(), rudolph_head(c['neck']), rudolph_arm(-1, c['shoulder']), rudolph_arm(1, c['shoulder'])]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    preview = argv[0] if argv else os.path.join(ROOT, '_box', 'xmas-preview')
    os.makedirs(preview, exist_ok=True)
    propkit.setup()
    propkit.floor()
    made = {}
    for name in ('santa', 'rudolph'):
        objs = build(name)
        bpy.context.view_layer.update()
        path = os.path.join(MODELS_DIR, 'resident-%s.glb' % name)
        propkit.export(objs, path)
        info = propkit.metrics(objs)
        info['neck'] = CHARS[name]['neck']
        info['shoulder'] = list(CHARS[name]['shoulder'])
        info['bytes'] = os.path.getsize(path)
        made[name] = (objs, info)
        # 다음 주민이 같은 부위 이름(body·head …)을 쓰도록 내보낸 것은 이름을 바꿔 둔다 (겹치면 Blender가 .001을 붙인다)
        for o in objs:
            o.name = '%s_%s' % (name, o.name)
            o.data.name = o.name
        for other, (others, _) in made.items():
            for o in others:
                o.hide_render = other != name
        propkit.shoot(objs, os.path.join(preview, '%s-front.png' % name), direction=(0.35, -1.0, 0.18), res=(480, 720), zoom=0.8)
        propkit.shoot(objs, os.path.join(preview, '%s-side.png' % name), direction=(1.0, -0.2, 0.15), res=(480, 720), zoom=0.8)
        propkit.shoot(objs, os.path.join(preview, '%s-face.png' % name), direction=(0.3, -1.0, 0.12), res=(560, 560),
                      center=(0, 0, CHARS[name]['neck'] + 0.17), size=0.5)
        print('OK', name, info)
    # 둘을 나란히 + 크기 비교 고양이
    for name, dx in (('santa', -0.4), ('rudolph', 0.4)):
        for o in made[name][0]:
            o.hide_render = False
            o.location.x += dx
    cat = propkit.scale_cat(0.0, -0.5)
    allobjs = made['santa'][0] + made['rudolph'][0] + [cat]
    propkit.shoot(allobjs, os.path.join(preview, 'residents-pair.png'), direction=(0.25, -1.0, 0.3), res=(800, 640), zoom=0.75)
    json.dump({k: v[1] for k, v in made.items()}, open(os.path.join(preview, 'residents.json'), 'w'), indent=1)
    print('DONE')


main()
