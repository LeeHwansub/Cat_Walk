# Blender 스크립트

Blender 5.4 명령줄(`-b`)로 실행하는 고양이 자세 스크립트. 화면 없이 렌더 이미지로 확인하며 다듬는다.

| 파일 | 내용 |
|---|---|
| `posekit.py` | 공통 도구: `cat.glb` 불러오기, 고양이 기준 축(앞·위·왼쪽) 계산, 뼈 돌리기, 렌더 |
| `poses.py` | 누운 자세 5개(`bellyUp` 배 보이기, `sideLie` 옆으로 눕기, `loafPose` 식빵, `napPose` 낮잠, `wrapPose` 꼬리 감기)를 잡아 렌더하고 `cat-poses.glb`로 내보냄. 환경 변수 `POSES=loafPose,napPose`로 일부만 렌더 |

## 실행 (저장소 루트에서)

```bash
# 미리보기만
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/poses.py -- /tmp/pose
# 미리보기 + 게임 파일 다시 만들기
/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/poses.py -- /tmp/pose web/public/assets/models/cat-poses.glb
```

## 자세 잡기
- `rot(arm, 뼈, 축, 각도)`: 고양이 기준 축(F 앞, U 위, L 왼쪽) 둘레로 돌린다. L 둘레 +각도는 옆에서 볼 때 시계 방향.
- `aim(arm, 뼈들, 방향들)`: 다리처럼 옆에서 본 뼈 방향(도: 0 앞, -90 아래, ±180 뒤)을 정해 준다. 부호를 짐작할 필요가 없다.

## 주의 (D-44)
- `cat.glb`는 기본 옵션으로 불러오면 메시가 뭉개진다. `guess_original_bind_pose=False`, `bone_heuristic='TEMPERANCE'`로 불러오고 파일에 든 걷기 동작 연결을 지운다 (`posekit.load`).
- 모델이 커서(약 500 단위) 카메라 그리기 거리를 늘려야 렌더가 나온다 (`posekit.render`).
- 내보낸 파일은 뼈 기준 축이 원본과 달라, 게임에서는 회전값을 그대로 쓰지 않고 기준 자세에서 돈 만큼만 옮긴다 (`SkinnedCatRig`의 누운 자세).
- 꼬리·귀·눈·입은 자세에 넣지 않는다 (코드가 움직인다). 자세에 쓰는 뼈 목록은 `web/src/cat/liePoses.ts`와 같아야 한다 (`web/tests/liePoses.test.ts`가 확인).
