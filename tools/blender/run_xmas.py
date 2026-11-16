# -*- coding: utf-8 -*-
# Blender 화면(스크립팅 탭의 텍스트 편집기)에서 "스크립트 실행"으로 돌리는 실행기.
# 열려 있는 Blender는 건드리지 않고, 화면 없는 Blender를 따로 띄워 소품·주민 스크립트를 돌린다.
# 할 일은 _box/xmas-preview/jobs.txt (한 줄에 "스크립트 [PROPS 값]"), 없으면 xmas_props와 npc 전체.
# 기록은 _box/xmas-preview/log.txt, 끝나면 마지막 줄에 ALL DONE.
import bpy, os, subprocess
T = next(t for t in bpy.data.texts if t.name.startswith('run_xmas'))
HERE = os.path.dirname(bpy.path.abspath(T.filepath))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, '_box', 'xmas-preview')
os.makedirs(OUT, exist_ok=True)
jobs = [('xmas_props', ''), ('npc', '')]
jp = os.path.join(OUT, 'jobs.txt')
if os.path.exists(jp):
    jobs = []
    for line in open(jp):
        p = line.split()
        if p:
            jobs.append((p[0], p[1] if len(p) > 1 else ''))
cmd = []
for name, props in jobs:
    cmd.append('PROPS="%s" "%s" -b --python "%s"' % (props, bpy.app.binary_path, os.path.join(HERE, name + '.py')))
full = '(' + ' ; '.join(cmd) + ' ; echo ALL DONE) > "%s" 2>&1' % os.path.join(OUT, 'log.txt')
subprocess.Popen(full, shell=True, cwd=ROOT)
print('started', jobs)
