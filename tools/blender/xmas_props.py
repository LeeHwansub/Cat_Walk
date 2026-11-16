# -*- coding: utf-8 -*-
# 크리스마스 맵 "눈 오는 광장" 소품 18종을 만들어 glb로 내보내고 미리보기를 렌더한다.
# 실행 (저장소 루트에서):
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/xmas_props.py -- <미리보기 폴더>
# 환경 변수 PROPS=snowman,sled 로 일부만. 크기 기준은 보드 X-04 소품 시트.
import bpy, math, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, propkit
importlib.reload(propkit)
from propkit import Mesh, M, PROPS_DIR, ROOT
from mathutils import Vector

C = dict(snow='#f4f7fc', snow2='#dfe7f3', red='#c8433f', red2='#a53330', green='#2f6b4a', green2='#245540', green3='#3f8a5c',
         gold='#e2b04a', wood='#8a5a3a', wood2='#5e3d28', wood3='#b98556', cream='#f4efe6', ice='#b9dbee', stone='#8d9099',
         stone2='#6f727c', black='#2b2b30', orange='#e8862e', warm='#ffd27a', fire='#ff9a3c', yellow='#ffe9a0', blue='#7fc4ff',
         kraft='#c9a276', iron='#3a4048', roof='#7a3b34', ash='#4a4744', glowred='#ff5a4f')
BULBS = [C['warm'], C['warm'], C['glowred'], C['warm'], C['blue']]


def tier(m, z, r, h, col, seg=10, phase=0.0, snow=0.46):
    """트리 한 단: 처진 밑단 + 원뿔, 위쪽에 가장자리가 들쭉날쭉한 눈"""
    m.loft(col, [(0, 0, z - 0.1 * h, r * 0.8, r * 0.8), (0, 0, z, r, r), (0, 0, z + h, 0.02, 0.02)], seg=seg, phase=phase)
    k = snow
    _, vr = m.loft(C['snow'], [(0, 0, z + h * (1 - k), r * k + 0.04, r * k + 0.04), (0, 0, z + h + 0.03, 0.03, 0.03)], seg=seg, cap=False, phase=phase)
    for v in vr[0]:
        dz = m.rng.uniform(0, 0.2) * h
        d = Vector((v.co.x, v.co.y, 0)).normalized()
        v.co += d * (dz * r / h)
        v.co.z -= dz


def bow(m, c, loc, s=1.0):
    """정면(-Y)을 보는 리본 매듭"""
    x, y, z = loc
    m.box(c, (0.07 * s, 0.05 * s, 0.07 * s), (x, y, z - 0.035 * s))
    for sx in (-1, 1):
        m.ball(c, 1.0, (x + sx * 0.1 * s, y, z + 0.01 * s), scale=(0.1 * s, 0.035 * s, 0.065 * s), rot=(0, sx * -18, 0))
        m.box(c, (0.045 * s, 0.015 * s, 0.2 * s), (x + sx * 0.035 * s, y - 0.005, z - 0.22 * s), rot=(0, sx * -14, 0))


def xmas_tree_large():
    m = Mesh('xmas-tree-large', 11)
    m.cyl(C['wood2'], 0.3, 0.24, 1.0, seg=8)
    tiers = [(0.75, 2.3, 1.9), (1.85, 1.95, 1.7), (2.85, 1.55, 1.5), (3.75, 1.15, 1.35), (4.55, 0.78, 1.4)]
    nb = [11, 10, 8, 6, 4]
    no = [6, 5, 4, 3, 0]
    for i, (z, r, h) in enumerate(tiers):
        ph = i * 0.31
        tier(m, z, r, h, C['green'] if i % 2 == 0 else C['green2'], seg=10, phase=ph)
        for j in range(nb[i]):
            a = ph + 2 * math.pi * (j + 0.5 * (i % 2)) / nb[i]
            t = 0.12 + 0.16 * ((j * 7 + i) % 3) / 2
            rr = r * (1 - t) + 0.05
            m.ball(BULBS[(j + i) % len(BULBS)], 0.07, (rr * math.cos(a), rr * math.sin(a), z + h * t), glow=True)
        for j in range(no[i]):
            a = ph + 0.5 + 2 * math.pi * j / no[i]
            m.uv(C['red'] if (j + i) % 2 == 0 else C['gold'], 0.11, (r * 0.93 * math.cos(a), r * 0.93 * math.sin(a), z - 0.1), u=8, v=5)
    m.star(C['yellow'], 0.36, 0.16, 0.09, (0, 0, 6.15))
    return [m.finish()]


def xmas_tree_small():
    m = Mesh('xmas-tree-small', 12)
    m.cyl(C['red'], 0.2, 0.27, 0.3, seg=8)
    m.cyl(C['red2'], 0.29, 0.29, 0.06, (0, 0, 0.26), seg=8)
    m.cyl(C['snow'], 0.25, 0.22, 0.05, (0, 0, 0.3), seg=8)
    m.cyl(C['wood2'], 0.05, 0.045, 0.18, (0, 0, 0.3), seg=6)
    for i, (z, r, h) in enumerate([(0.46, 0.42, 0.5), (0.74, 0.33, 0.42), (1.0, 0.23, 0.36)]):
        tier(m, z, r, h, C['green'] if i % 2 == 0 else C['green3'], seg=8, phase=i * 0.4, snow=0.4)
        n = [4, 3, 2][i]
        for j in range(n):
            a = i * 0.9 + 2 * math.pi * j / n
            rr = r * 0.78 + 0.02
            m.ball(BULBS[(j + i) % len(BULBS)], 0.035, (rr * math.cos(a), rr * math.sin(a), z + h * 0.22), glow=True)
    m.star(C['yellow'], 0.09, 0.04, 0.025, (0, 0, 1.4))
    return [m.finish()]


def gift(name, w, h, body, ribbon, lidc, seed, stripes=None, tag=False):
    m = Mesh(name, seed)
    lh = max(0.05, h * 0.16)
    bw = w * 0.94
    e = 0.006
    m.box(body, (bw, bw, h - lh), (0, 0, 0))
    m.box(lidc, (w, w, lh), (0, 0, h - lh))
    rw = w * 0.16
    m.box(ribbon, (rw, bw + 2 * e, h - lh), (0, 0, 0))
    m.box(ribbon, (bw + 2 * e, rw, h - lh), (0, 0, 0))
    m.box(ribbon, (rw, w + 2 * e, lh + e), (0, 0, h - lh))
    m.box(ribbon, (w + 2 * e, rw, lh + e), (0, 0, h - lh))
    if stripes:
        for sx in (-1, 1):
            for k in (0.3, 0.42):
                m.box(stripes, (0.03, bw + e, h - lh - 0.02), (sx * w * k, 0, 0.01))
                m.box(stripes, (bw + e, 0.03, h - lh - 0.02), (0, sx * w * k, 0.01))
    if tag:
        m.box(C['cream'], (0.09, 0.008, 0.06), (w * 0.26, -w / 2 - 0.006, h - lh - 0.1), rot=(0, 12, 0))
        m.rod(C['gold'], (w * 0.2, -w / 2 - 0.004, h - lh), (w * 0.25, -w / 2 - 0.008, h - lh - 0.045), 0.004, seg=4)
    return [m.finish()]


def gift_box_s():
    return gift('gift-box-s', 0.32, 0.30, C['red'], C['gold'], C['red2'], 21)


def gift_box_m():
    return gift('gift-box-m', 0.52, 0.50, C['green'], C['cream'], C['green2'], 22, tag=True)


def gift_box_l():
    return gift('gift-box-l', 0.82, 0.80, C['cream'], C['red'], '#e7dfd0', 23, stripes='#e3d8c6')


def gift_box_open():
    m = Mesh('gift-box-open', 24)
    w, h, t = 0.62, 0.40, 0.016
    m.box(C['kraft'], (w, w, 0.05), (0, 0, 0))
    for s in (-1, 1):
        m.box(C['red'], (w, t, h), (0, s * (w / 2 - t / 2), 0))
        m.box(C['kraft'], (w - 2 * t, t, h - 0.004), (0, s * (w / 2 - 1.5 * t), 0))
        m.box(C['red'], (t, w - 2 * t, h), (s * (w / 2 - t / 2), 0, 0))
        m.box(C['kraft'], (t, w - 4 * t, h - 0.004), (s * (w / 2 - 1.5 * t), 0, 0))
        m.box(C['gold'], (0.1, 0.006, h), (0, s * (w / 2 + 0.003), 0))
        m.box(C['gold'], (0.006, 0.1, h), (s * (w / 2 + 0.003), 0, 0))
    # 뚜껑은 뒤쪽 벽에 기대 세운다
    ly = w / 2 + 0.2
    m.box(C['red2'], (0.66, 0.07, 0.66), (0, ly, 0.02), rot=(18, 0, 0))
    m.box(C['gold'], (0.1, 0.082, 0.662), (0, ly, 0.02), rot=(18, 0, 0))
    m.box(C['gold'], (0.662, 0.082, 0.1), (0, ly - 0.087, 0.267), rot=(18, 0, 0))
    return [m.finish()]


def market_stall():
    m = Mesh('market-stall', 31)
    m.box(C['wood'], (2.3, 0.85, 0.80), (0, -0.1, 0))
    for i in range(9):
        m.box(C['wood2'], (0.02, 0.01, 0.76), (-1.02 + i * 0.255, -0.53, 0.02))
    m.box(C['wood3'], (2.5, 1.0, 0.06), (0, -0.1, 0.80))
    for sx in (-1.15, 1.15):
        m.box(C['wood2'], (0.08, 0.08, 2.0), (sx, -0.52, 0))
        m.box(C['wood2'], (0.08, 0.08, 2.42), (sx, 0.6, 0))
    m.box(C['wood'], (2.3, 0.04, 1.25), (0, 0.6, 0.86))
    for i in range(4):
        m.box(C['wood2'], (2.3, 0.012, 0.012), (0, 0.575, 1.1 + i * 0.28))
    # 줄무늬 차양 (뒤가 높다)
    ang = math.degrees(math.atan2(0.5, 1.6))
    L = math.hypot(1.6, 0.5)
    for i in range(10):
        m.box(C['red'] if i % 2 == 0 else C['cream'], (0.262, L, 0.04), (-1.17 + i * 0.26, -0.05, 2.22), rot=(ang, 0, 0))
        m.box(C['cream'] if i % 2 == 0 else C['red'], (0.262, 0.02, 0.16 if i % 2 == 0 else 0.12), (-1.17 + i * 0.26, -0.86, 1.83 if i % 2 == 0 else 1.87))
    for (x, y, sx, sy) in [(-0.7, 0.35, 0.55, 0.36), (0.1, 0.42, 0.7, 0.3), (0.8, 0.3, 0.45, 0.38), (-0.2, -0.25, 0.5, 0.3), (0.65, -0.35, 0.4, 0.26), (-0.9, -0.4, 0.3, 0.24)]:
        z = 2.25 + (y + 0.05) * 0.5 / 1.6 + 0.03
        m.ball(C['snow'], 1.0, (x, y, z), scale=(sx, sy, 0.09), sub=2, flat=True, jit=0.1, rot=(ang, 0, 0))
    # 처마 전구
    m.box(C['iron'], (2.3, 0.008, 0.008), (0, -0.87, 1.80))
    for i in range(7):
        m.ball(BULBS[i % len(BULBS)], 0.05, (-1.05 + i * 0.35, -0.87, 1.75), glow=True)
    # 진열 (뒤쪽에만: 앞쪽은 고양이가 올라서는 자리)
    m.box(C['wood2'], (0.42, 0.3, 0.16), (-0.8, 0.28, 0.86))
    for i, (x, y) in enumerate([(-0.92, 0.22), (-0.8, 0.24), (-0.68, 0.22), (-0.86, 0.34), (-0.74, 0.34)]):
        m.ball(C['orange'], 0.062, (x, y, 1.05), sub=1)
    for i in range(3):
        m.cyl(C['cream'], 0.06, 0.06, 0.15, (0.45 + i * 0.2, 0.3, 0.86), seg=8)
        m.cyl(C['red'], 0.064, 0.064, 0.03, (0.45 + i * 0.2, 0.3, 1.01), seg=8)
    m.cyl(C['green2'], 0.09, 0.07, 0.1, (-0.2, 0.32, 0.86), seg=8)
    m.cyl(C['green'], 0.14, 0.01, 0.3, (-0.2, 0.32, 0.96), seg=7)
    # 간판
    m.box(C['red2'], (0.74, 0.03, 0.24), (0, -0.6, 1.5))
    m.box(C['cream'], (0.66, 0.036, 0.16), (0, -0.6, 1.54))
    for sx in (-0.3, 0.3):
        m.rod(C['iron'], (sx, -0.6, 1.74), (sx, -0.6, 2.03), 0.006, seg=4)
    return [m.finish()]


def ribbon_lamp():
    m = Mesh('ribbon-lamp', 32)
    m.cyl(C['iron'], 0.16, 0.11, 0.3, seg=8)
    m.cyl(C['iron'], 0.06, 0.05, 2.42, (0, 0, 0.3), seg=8)
    m.cyl(C['iron'], 0.09, 0.09, 0.05, (0, 0, 1.0), seg=8)
    m.cyl(C['iron'], 0.15, 0.15, 0.04, (0, 0, 2.7), seg=4, rot=(0, 0, 45))
    m.box(C['warm'], (0.17, 0.17, 0.27), (0, 0, 2.74), glow=True)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(C['iron'], (0.022, 0.022, 0.27), (sx * 0.09, sy * 0.09, 2.74))
    m.cyl(C['iron'], 0.2, 0.03, 0.15, (0, 0, 3.01), seg=4, rot=(0, 0, 45))
    m.ball(C['snow'], 1.0, (0, 0, 3.07), scale=(0.13, 0.13, 0.07), sub=1, flat=True, jit=0.08)
    m.ball(C['iron'], 0.025, (0, 0, 3.17))
    # 기둥을 감은 초록 장식과 리본
    pts = []
    for i in range(31):
        t = i / 30
        a = t * 2 * math.pi * 3.5
        pts.append((0.085 * math.cos(a), 0.085 * math.sin(a), 0.5 + t * 1.95))
    m.pipe(C['green3'], pts, 0.032, seg=5)
    for i in range(0, 31, 5):
        m.ball(C['red'], 0.035, pts[i])
    bow(m, C['red'], (0, -0.1, 2.05), 1.1)
    return [m.finish()]


def log_cabin():
    m = Mesh('log-cabin', 33)
    R = 0.15
    m.box(C['wood2'], (3.7, 2.9, 2.5), (0, 0, 0))
    for k in range(8):
        z = R + 0.3 * k
        for sy in (-1.5, 1.5):
            m.cyl(C['wood'] if k % 2 == 0 else '#80523a', R, R, 4.2, (-2.1, sy, z), rot=(0, 90, 0), seg=7, capc=C['wood3'])
        for sx in (-1.9, 1.9):
            m.cyl(C['wood'] if k % 2 == 1 else '#80523a', R, R, 3.4, (sx, -1.7, z + 0.15), rot=(-90, 0, 0), seg=7, capc=C['wood3'])
    # 박공 (옆벽 위 세모)
    for sx in (-1.9, 1.9):
        m.prism(C['wood'], [(-1.62, 0), (1.62, 0), (0, 1.56)], 0.2, (sx, 0, 2.42), rot=(0, 0, 90))
    # 지붕과 눈
    run, rise = 1.9, 1.9
    L = math.hypot(run, rise)
    for s in (-1, 1):
        ang = s * -45
        my, mz = s * (run / 2), 3.98 - rise / 2
        m.box(C['roof'], (4.6, L, 0.12), (0, my, mz), rot=(ang, 0, 0))
        n = Vector((0, s * math.sin(math.radians(45)), math.cos(math.radians(45))))
        p = Vector((0, my, mz)) + n * 0.12
        fs = m.box(C['snow'], (4.66, L * 0.96, 0.17), tuple(p), rot=(ang, 0, 0), jit=0.03)
    m.pipe(C['snow'], [(-2.33, 0, 4.2), (-1.2, 0, 4.24), (0, 0, 4.2), (1.3, 0, 4.25), (2.33, 0, 4.2)], 0.16, seg=6)
    # 굴뚝
    m.box(C['stone'], (0.55, 0.55, 1.5), (1.2, 0.75, 3.0))
    m.box(C['stone2'], (0.65, 0.65, 0.1), (1.2, 0.75, 4.45))
    m.ball(C['snow'], 1.0, (1.2, 0.75, 4.55), scale=(0.34, 0.34, 0.12), sub=1, flat=True, jit=0.08)
    # 문·창 (정면 -Y)
    fy = -1.65
    m.box(C['wood3'], (1.06, 0.1, 2.0), (0, fy + 0.02, 0))
    m.box(C['wood2'], (0.9, 0.12, 1.9), (0, fy, 0))
    for i in range(3):
        m.box('#4f3221', (0.012, 0.125, 1.86), (-0.22 + i * 0.22, fy, 0.02))
    m.ball(C['gold'], 0.035, (0.33, fy - 0.07, 0.95))
    m.torus(C['green'], 0.2, 0.065, (0, fy - 0.08, 1.45), rot=(90, 0, 0), seg=10, tube=5)
    bow(m, C['red'], (0, fy - 0.13, 1.3), 0.7)
    for sx in (-1.25, 1.25):
        m.box(C['wood3'], (0.92, 0.1, 0.92), (sx, fy + 0.02, 0.95))
        m.box(C['warm'], (0.76, 0.12, 0.76), (sx, fy + 0.01, 1.03), glow=True)
        m.box(C['wood3'], (0.04, 0.14, 0.76), (sx, fy + 0.01, 1.03))
        m.box(C['wood3'], (0.76, 0.14, 0.04), (sx, fy + 0.01, 1.39))
        m.ball(C['snow'], 1.0, (sx, fy - 0.06, 0.95), scale=(0.5, 0.1, 0.06), sub=1, flat=True, jit=0.08)
    m.box(C['stone'], (1.3, 0.45, 0.12), (0, fy - 0.25, 0))
    # 처마 전구와 고드름
    ey, ez = -run - 0.02, 3.98 - rise - 0.1
    m.box(C['iron'], (4.5, 0.008, 0.008), (0, ey, ez))
    for i in range(11):
        m.ball(BULBS[i % len(BULBS)], 0.055, (-2.1 + i * 0.42, ey, ez - 0.05), glow=True)
    for i in range(9):
        hh = 0.14 + 0.16 * ((i * 5) % 4) / 3
        m.cyl(C['ice'], 0.004, 0.035, hh, (-1.9 + i * 0.47 + 0.2, ey + 0.06, ez + 0.06 - hh), seg=5)
    for (x, y, s) in [(-2.25, -1.85, 0.5), (2.2, -1.8, 0.45), (-2.2, 1.8, 0.4), (2.25, 1.85, 0.5)]:
        m.ball(C['snow2'], 1.0, (x, y, 0), scale=(s, s * 0.8, s * 0.5), sub=1, flat=True, jit=0.1)
    return [m.finish()]


def firewood_stack():
    m = Mesh('firewood-stack', 34)
    r = 0.105
    rows = [(0.105, [-0.44, -0.22, 0, 0.22, 0.44]), (0.29, [-0.33, -0.11, 0.11, 0.33]), (0.475, [-0.44, -0.22, 0, 0.22, 0.44])]
    for z, xs in rows:
        for x in xs:
            L = 0.86 + m.rng.uniform(-0.05, 0.05)
            y0 = -L / 2 + m.rng.uniform(-0.03, 0.03)
            m.cyl(C['wood'] if m.rng.random() < 0.6 else '#7b4f34', r, r, L, (x, y0, z), rot=(-90, 0, 0), seg=7, capc=C['wood3'])
    for sx in (-0.57, 0.57):
        for sy in (-0.26, 0.26):
            m.box(C['wood2'], (0.055, 0.055, 0.6), (sx, sy, 0))
    m.ball(C['snow'], 1.0, (-0.1, 0, 0.56), scale=(0.5, 0.44, 0.09), sub=2, flat=True, jit=0.1)
    m.ball(C['snow'], 1.0, (0.32, 0.1, 0.56), scale=(0.24, 0.3, 0.07), sub=1, flat=True, jit=0.1)
    return [m.finish()]


def fire_pit():
    m = Mesh('fire-pit', 35)
    m.cyl(C['ash'], 0.5, 0.5, 0.04, seg=9)
    for i in range(9):
        a = 2 * math.pi * i / 9
        m.ball(C['stone'] if i % 2 == 0 else C['stone2'], 1.0, (0.56 * math.cos(a), 0.56 * math.sin(a), 0), scale=(0.15, 0.2, 0.17), sub=1, flat=True, jit=0.16, rot=(0, 0, math.degrees(a)))
    for i in range(4):
        a = 0.4 + 2 * math.pi * i / 4
        m.rod(C['wood2'], (0.3 * math.cos(a), 0.3 * math.sin(a), 0.05), (-0.04 * math.cos(a), -0.04 * math.sin(a), 0.42), 0.05, seg=6, capc=C['wood3'])
    m.cyl(C['fire'], 0.2, 0.01, 0.56, (0, 0, 0.1), seg=6, glow=True)
    m.cyl(C['yellow'], 0.12, 0.01, 0.36, (0, 0.0, 0.12), seg=6, glow=True, rot=(0, 0, 30))
    m.cyl(C['fire'], 0.1, 0.01, 0.34, (0.12, 0.05, 0.08), seg=5, glow=True, rot=(0, 14, 0))
    m.cyl(C['glowred'], 0.09, 0.01, 0.3, (-0.11, -0.06, 0.08), seg=5, glow=True, rot=(0, -14, 0))
    for (x, y) in [(0.22, -0.18), (-0.2, 0.2), (0.05, 0.3), (-0.28, -0.1), (0.3, 0.12)]:
        m.ball(C['fire'], 0.03, (x, y, 0.05), glow=True)
    return [m.finish()]


def snowman():
    m = Mesh('snowman', 36)
    m.ball(C['snow'], 0.39, (0, 0, 0.4), sub=2, jit=0.02)
    m.ball(C['snow'], 0.3, (0, 0, 0.97), sub=2, jit=0.03)
    m.ball(C['snow'], 0.21, (0, 0, 1.4), sub=2, jit=0.02)
    m.ball(C['snow2'], 1.0, (0, 0, 0), scale=(0.55, 0.55, 0.12), sub=1, flat=True, jit=0.1)
    # 모자
    m.cyl(C['black'], 0.21, 0.21, 0.03, (0, 0, 1.56), seg=10)
    m.cyl(C['black'], 0.14, 0.15, 0.22, (0, 0, 1.58), seg=10)
    m.cyl(C['red'], 0.153, 0.153, 0.05, (0, 0, 1.6), seg=10)
    # 얼굴
    for sx in (-0.07, 0.07):
        m.ball(C['black'], 0.026, (sx, -0.19, 1.46))
    m.rod(C['orange'], (0, -0.19, 1.4), (0, -0.42, 1.38), 0.036, 0.004, seg=6)
    for i in range(5):
        a = math.radians(-40 + i * 20)
        m.ball(C['black'], 0.014, (0.085 * math.sin(a), -0.195, 1.335 - 0.035 * math.cos(a) + 0.03))
    for z in (0.86, 0.98, 1.1):
        m.ball(C['black'], 0.028, (0, -math.sqrt(max(0.0, 0.3 ** 2 - (z - 0.97) ** 2)) - 0.005, z))
    # 목도리
    m.torus(C['red'], 0.19, 0.055, (0, 0, 1.23), seg=10, tube=5, scale=(1, 1, 0.8))
    m.box(C['red'], (0.1, 0.035, 0.3), (0.11, -0.22, 0.93), rot=(-8, 0, -6))
    m.box(C['cream'], (0.102, 0.037, 0.04), (0.112, -0.224, 0.97), rot=(-8, 0, -6))
    # 나뭇가지 팔
    for s in (-1, 1):
        m.rod(C['wood2'], (s * 0.25, 0, 1.02), (s * 0.6, -0.04, 1.32), 0.022, 0.014, seg=5)
        m.rod(C['wood2'], (s * 0.5, -0.03, 1.235), (s * 0.62, -0.02, 1.2), 0.012, seg=4)
        m.rod(C['wood2'], (s * 0.53, -0.03, 1.26), (s * 0.55, 0.0, 1.4), 0.012, seg=4)
    return [m.finish()]


def sled():
    m = Mesh('sled', 37)
    for sx in (-0.25, 0.25):
        pts = [(sx, 0.72, 0.03), (sx, 0.2, 0.03), (sx, -0.3, 0.03)]
        for i in range(0, 11):
            ph = math.radians(i * 20)
            pts.append((sx, -0.5 - 0.22 * math.sin(ph), 0.25 - 0.22 * math.cos(ph)))
        m.pipe(C['red'], pts, 0.022, seg=6)
        for y in (-0.28, 0.15, 0.58):
            m.box(C['red2'], (0.03, 0.03, 0.25), (sx, y, 0.04))
    for y in (-0.28, 0.15, 0.58):
        m.box(C['wood'], (0.56, 0.05, 0.03), (0, y, 0.275))
    for i in range(5):
        m.box(C['wood3'] if i % 2 == 0 else '#ad7a4c', (0.1, 1.08, 0.025), (-0.22 + i * 0.11, 0.15, 0.305))
    m.rod(C['wood'], (-0.25, -0.5, 0.47), (0.25, -0.5, 0.47), 0.02, seg=6)
    m.pipe(C['cream'], [(-0.12, -0.5, 0.47), (-0.1, -0.62, 0.3), (-0.02, -0.74, 0.1), (0.06, -0.8, 0.02), (0.12, -0.7, 0.02), (0.1, -0.6, 0.25), (0.12, -0.5, 0.47)], 0.012, seg=5)
    return [m.finish()]


def snow_pile():
    m = Mesh('snow-pile', 38)
    m.ball(C['snow'], 1.0, (0, 0, 0), scale=(0.8, 0.62, 0.4), sub=2, flat=True, jit=0.1)
    m.ball(C['snow2'], 1.0, (0.5, -0.3, 0), scale=(0.36, 0.34, 0.22), sub=2, flat=True, jit=0.1)
    m.ball(C['snow2'], 1.0, (-0.55, 0.3, 0), scale=(0.3, 0.3, 0.18), sub=1, flat=True, jit=0.1)
    return [m.finish()]


def wooden_reindeer():
    m = Mesh('wooden-reindeer', 39)
    m.rod(C['wood'], (0, 0.45, 1.0), (0, -0.4, 1.04), 0.2, seg=8, capc=C['wood3'])
    for s in (-1, 1):
        m.rod(C['wood2'], (s * 0.12, -0.28, 0.92), (s * 0.2, -0.42, 0), 0.045, 0.04, seg=6)
        m.rod(C['wood2'], (s * 0.12, 0.33, 0.9), (s * 0.2, 0.5, 0), 0.045, 0.04, seg=6)
    m.rod(C['wood'], (0, -0.32, 1.1), (0, -0.6, 1.5), 0.1, 0.09, seg=7, capc=C['wood3'])
    m.rod(C['wood'], (0, -0.5, 1.53), (0, -0.86, 1.43), 0.115, 0.085, seg=7, capc=C['wood3'])
    m.ball(C['glowred'], 0.06, (0, -0.89, 1.43), glow=True)
    for s in (-1, 1):
        m.ball(C['black'], 0.02, (s * 0.085, -0.66, 1.53))
        m.rod(C['wood3'], (s * 0.08, -0.5, 1.6), (s * 0.19, -0.44, 1.66), 0.03, 0.006, seg=4)
        m.rod(C['wood2'], (s * 0.05, -0.55, 1.62), (s * 0.2, -0.5, 1.95), 0.022, 0.014, seg=5)
        m.rod(C['wood2'], (s * 0.12, -0.525, 1.77), (s * 0.27, -0.6, 1.86), 0.014, 0.01, seg=4)
        m.rod(C['wood2'], (s * 0.16, -0.51, 1.86), (s * 0.12, -0.4, 1.96), 0.013, 0.01, seg=4)
    m.rod(C['wood3'], (0, 0.44, 1.08), (0, 0.56, 1.2), 0.05, 0.02, seg=5)
    m.torus(C['red'], 0.115, 0.04, (0, -0.44, 1.27), rot=(-35, 0, 0), seg=10, tube=5)
    m.box(C['red'], (0.08, 0.03, 0.24), (0.07, -0.56, 1.0), rot=(-10, 0, -8))
    m.ball(C['snow'], 1.0, (0, 0.05, 1.19), scale=(0.15, 0.36, 0.05), sub=1, flat=True, jit=0.1)
    return [m.finish()]


def candy_cane_post():
    m = Mesh('candy-cane-post', 40)
    pts = [(0, 0, 0.15 * i) for i in range(15)]  # 0 ~ 2.1
    for i in range(1, 11):
        th = math.radians(180 - i * 20)
        pts.append((0.24 + 0.24 * math.cos(th), 0, 2.1 + 0.24 * math.sin(th)))
    m.pipe([C['red'], C['cream']], pts, 0.075, seg=8)
    m.ball(C['snow'], 1.0, (0, 0, 0), scale=(0.28, 0.26, 0.12), sub=1, flat=True, jit=0.1)
    bow(m, C['green'], (0, -0.09, 1.6), 0.9)
    m.ball(C['gold'], 0.035, (0, -0.11, 1.5))
    return [m.finish()]


def santa_mailbox():
    m = Mesh('santa-mailbox', 41)
    m.box(C['wood2'], (0.1, 0.1, 0.96), (0, 0, 0))
    m.rod(C['wood2'], (0, 0.03, 0.62), (0, 0.2, 0.94), 0.03, seg=4)
    m.box(C['wood'], (0.26, 0.46, 0.03), (0, 0, 0.93))
    m.box(C['red'], (0.3, 0.5, 0.2), (0, 0, 0.955))
    m.cyl(C['red'], 0.15, 0.15, 0.5, (0, -0.25, 1.155), rot=(-90, 0, 0), seg=12)
    m.box(C['cream'], (0.31, 0.03, 0.2), (0, -0.2, 0.955))
    m.cyl(C['cream'], 0.156, 0.156, 0.03, (0, -0.215, 1.155), rot=(-90, 0, 0), seg=12)
    m.box(C['black'], (0.18, 0.01, 0.028), (0, -0.253, 1.12))
    m.ball(C['gold'], 0.022, (0, -0.262, 1.03))
    m.box(C['cream'], (0.13, 0.008, 0.09), (0.02, -0.262, 1.125), rot=(18, 0, 8))
    m.ball(C['red'], 0.014, (0.02, -0.285, 1.165))
    m.box(C['gold'], (0.015, 0.03, 0.24), (0.158, 0.06, 1.06))
    m.box(C['gold'], (0.015, 0.13, 0.08), (0.158, 0.01, 1.28))
    m.ball(C['snow'], 1.0, (0, 0.02, 1.285), scale=(0.15, 0.25, 0.08), sub=2, flat=True, jit=0.08)
    m.ball(C['snow2'], 1.0, (0, 0, 0), scale=(0.24, 0.24, 0.1), sub=1, flat=True, jit=0.1)
    return [m.finish()]


def yarn_ball():
    m = Mesh('yarn-ball', 42)
    m.uv(C['red'], 0.105, (0, 0, 0.11), u=10, v=7)
    for i, rot in enumerate([(20, 0, 0), (70, 30, 0), (100, -40, 20), (50, 80, 0), (140, 10, 60)]):
        m.torus(C['red2'] if i % 2 == 0 else '#dc6a63', 0.1, 0.012, (0, 0, 0.11), rot=rot, seg=12, tube=4)
    m.pipe('#dc6a63', [(0.08, -0.03, 0.03), (0.14, -0.06, 0.012), (0.2, -0.02, 0.012), (0.25, 0.05, 0.012), (0.33, 0.06, 0.012), (0.38, 0.0, 0.012)], 0.011, seg=5)
    return [m.finish()]


PROPS = [xmas_tree_large, xmas_tree_small, gift_box_s, gift_box_m, gift_box_l, gift_box_open, market_stall, ribbon_lamp, log_cabin,
         firewood_stack, fire_pit, snowman, sled, snow_pile, wooden_reindeer, candy_cane_post, santa_mailbox, yarn_ball]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    preview = argv[0] if argv else os.path.join(ROOT, '_box', 'xmas-preview')
    os.makedirs(preview, exist_ok=True)
    only = [s for s in os.environ.get('PROPS', '').split(',') if s]
    propkit.setup()
    out = {}
    mpath = os.path.join(preview, 'metrics.json')
    if only and os.path.exists(mpath):
        out = json.load(open(mpath))
    for fn in PROPS:
        name = fn.__name__.replace('_', '-')
        if only and name not in only:
            continue
        try:
            objs = fn()
            propkit.export(objs, os.path.join(PROPS_DIR, name + '.glb'))
            out[name] = propkit.metrics(objs)
            lo, hi, _ = propkit.bounds(objs)
            fl = propkit.floor()
            cat = propkit.scale_cat(hi.x + 0.3, lo.y - 0.05)
            propkit.shoot(objs + [cat], os.path.join(preview, name + '.png'))
            print('OK', name, out[name])
        except Exception as e:
            import traceback
            traceback.print_exc()
            print('FAIL', name, e)
        propkit.clear()
    json.dump(out, open(mpath, 'w'), indent=1)
    print('DONE')


main()
