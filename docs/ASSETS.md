# 에셋 및 라이선스 기록

> 출처·라이선스·수정 내역의 최신 정리는 프로젝트 루트 **`CREDITS.md`**(데이터 원본 `web/src/info/credits.ts`)에 있다. 이 문서는 조사·결정 과정 기록이다.

기획서 17.4: 외부 에셋을 쓰면 출처와 라이선스를 기록하고, 임시 에셋은 명시한다.

## 1. 현재 사용 중인 외부 에셋

### 1.1 사용자 제공 소리 파일 (2026-11-04 추가)

사용자가 `_box/Audio/`로 제공한 파일을 **수정하지 않고** 이름만 바꿔 복사했다. 앞 무음 건너뛰기와 음량 맞춤은 재생할 때만 적용한다(`web/src/audio/clips.ts`).

| 저장소 파일 (`web/public/assets/sounds/`) | 원본 파일명 | 길이 | 용도 | 출처 | 라이선스 |
|---|---|---|---|---|---|
| meow-1.mp3 | 고양이울음 1.mp3 | 2.1초 | 일반 울음 | pgtd.tistory.com/127 | CC BY 4.0 |
| meow-2.mp3 | 고양이 울음2.mp3 | 1.8초 | 일반 울음 | pgtd.tistory.com/127 | CC BY 4.0 |
| meow-3.mp3 | 고양이 울음3.mp3 | 1.1초 | 일반 울음 | pgtd.tistory.com/127 | CC BY 4.0 |
| meow-curious.mp3 | 고양이 울음 궁금.mp3 | 2.2초 | 둘러보기 | pgtd.tistory.com/127 | CC BY 4.0 |
| meow-hungry.mp3 | 고양이 울음 배고픔.mp3 | 2.8초 | 먹이·급식소 | pgtd.tistory.com/127 | CC BY 4.0 |
| kitten-meow-1.mp3 | 새끼 고양이 울음1.mp3 | 1.9초 | 새끼 고양이 | pgtd.tistory.com/127 | CC BY 4.0 |
| purr-1.m4a | 골골1.m4a | 29.7초 | 골골송 (번갈아 반복 재생) | 사용자 직접 녹음 (2024-12-19, 휴대폰) | 프로젝트 소유자 저작물 (D-22) |
| purr-2.m4a | 골골2.m4a | 10.0초 | 골골송 (번갈아 반복 재생) | 사용자 직접 녹음 (2024-10-13, 휴대폰) | 프로젝트 소유자 저작물 (D-22) |

**출처 (D-19, 2026-11-04 사용자 제공):** [고양이 효과음 MP3 다운로드 — pgtd.tistory.com/127](https://pgtd.tistory.com/127), 작성자 "【 -라일락- 】", 2019-05-24 게시
**라이선스:** 페이지에 [CC BY 4.0 (저작자표시)](https://creativecommons.org/licenses/by/4.0/deed.ko) 표시

⚠️ 확인되지 않은 점
1. 처음 받은 골골송(`골골송.mp3`)은 출처 페이지 목록에 없었고 출처도 기억나지 않아(D-22) **사용을 중단했다.** 사용자가 직접 녹음한 파일 2개로 교체했다 (2026-11-05 사용자 확인). 출처 표기 대상이 아니다.
2. 저장소 파일명(궁금, 배고픔 등)이 페이지 목록 이름과 달라서 **파일별 대응 관계는 확인하지 못했다.**
3. 블로그 작성자가 원저작자인지는 확인하지 않았다.

**CC BY 4.0 조건:** 배포할 때 저작자, 출처 링크, 라이선스 링크를 표기해야 한다. 원본 파일은 수정하지 않았다 (재생할 때만 앞 무음 건너뛰기·음량 조절). **앱 설정 창 아래에 출처를 표기했다 (D-21, `web/index.html` `.credits`).**

**음량 맞춤 (2026-11-05, 사용자 요청 "음향 볼륨을 맞춰 줘"):** 원본은 그대로 두고 재생할 때 배율을 곱한다 (`web/src/audio/clips.ts` `analyzeClip`, `measureLufs`).
- 기준: 최대 음량이 아니라 **LUFS (ITU-R BS.1770, 사람이 느끼는 크기)**. K-가중 필터, 400ms 구간, 절대·상대 게이트, 스테레오는 두 채널 합.
- 목표 -16 LUFS. 울음은 최대 음량 0.95 제한(최대 6배), 골골송은 재생 시 1.8kHz 저역 통과 필터를 반영해 측정하고 최대 100배까지 키우며 순간적으로 튀는 소리는 리미터(-1dBFS)로 누른다.
- ffmpeg로 같은 처리를 재현해 측정한 결과:

| 파일 | 원본 | 재생 시 |
|---|---|---|
| 울음 6개 | -7.2 ~ -21.1 LUFS (14 LU 차이) | -15.0 ~ -16.2 LUFS (1.2 LU 차이) |
| 골골송 2개 | -47.6 / -54.2 LUFS | -17.7 / -17.9 LUFS |

골골송 녹음은 메타데이터상 안드로이드 휴대폰 녹음이며(com.android.version=14) 매우 작게 녹음되어 40~97배로 키운다. 그만큼 녹음 잡음도 커질 수 있다.

### 1.2 코드로 만든 에셋

| 종류 | 방식 | 위치 |
|---|---|---|
| 고양이 모델 | Three.js 기본 도형 조합 + IK 절차적 애니메이션 | `web/src/cat/ProceduralCatRig.ts` |
| 고양이 무늬 | canvas로 그린 줄무늬·얼룩 텍스처 | 같은 파일 |
| 맵(건물, 차, 나무, 화분 등) | 기본 도형 조합 | `web/src/world/map/neighborhood.ts` |
| 바닥·외벽 텍스처 | canvas로 그린 텍스처 | `web/src/world/textures.ts` |
| 바람·새소리 | Web Audio API 합성 | `web/src/audio/AudioManager.ts` |
| 울음소리·골골송 대체음 | Web Audio API 합성 (파일을 못 불러올 때만) | 같은 파일 |
| 글꼴 | 시스템 글꼴 (Apple SD Gothic Neo 등) | `web/src/ui/styles.css` |

## 2. 라이브러리

| 이름 | 라이선스 |
|---|---|
| three.js | MIT |
| Vite, Vitest | MIT |
| TypeScript | Apache-2.0 |

## 3. D-14 무료 고양이 모델 탐색 기록 (2026-11-04)

조건: CC0 또는 CC-BY, glTF, 걷기·앉기·눕기 동작 포함, 수정 허용

| 후보 | 결과 |
|---|---|
| [Cat Pilot (OpenGameArt)](https://opengameart.org/content/cat-pilot-rigged-animated) | CC0, 리깅됨. 그러나 `.blend` 형식이고 동작이 걷기·달리기 등으로 앉기 없음 |
| [Animated Animales Low Poly (OpenGameArt)](https://opengameart.org/content/animated-animales-low-poly) | CC0, 고양이 포함으로 표시. 파일 구성은 확인하지 않음. 게임용 저폴리 스타일 |
| [Gumroad 무료 고양이](https://downloadforfree.gumroad.com/l/free-animated-cat-game-ready-character-3d-model) | glTF 포함. 라이선스 명시 확인 안 됨 → 사용 불가 |
| [Paint Poly Cats (CGTrader)](https://www.cgtrader.com/3d-models/animal/mammal/paint-poly-cats-rigged-and-animated) | 동작 조건은 맞지만 유료 → 구매 승인 필요 |

결론: 조건에 맞는 무료 모델이 없어 코드 모델로 진행했다. 다운로드한 파일은 없다.

## 4. 사운드 (D-15, D-18)

D-18에 따라 사용자가 제공한 파일을 적용했다 (1.1절). 출처는 D-19, 앱 안 출처 표기는 D-21.

## 5. 리깅 모델 후보 조사 (2026-11-06, 2단계 D-23 C, 라이선스 확인까지만)

조건: 하나로 이어진 메시 + 뼈대, 걷기·앉기·눕기·그루밍 계열 동작, 웹(three.js)에서 쓸 수 있는 형식(glTF/GLB 또는 FBX 변환), 수정 허용(접힌 귀 수정), 상업적 이용.
**구매·다운로드는 하지 않았다.** 아래 내용은 판매 페이지와 라이선스 문서를 읽은 결과이며, 가격과 목록은 바뀔 수 있다.

### 5.1 마켓별 라이선스 핵심 (웹 게임 관점)

| 마켓 | 게임에 넣어 배포 | 웹에서의 문제 | 비고 |
|---|---|---|---|
| CGTrader Royalty Free ([약관 21A](https://www.cgtrader.com/pages/terms-and-conditions)) | 가능하지만 "**독점 형식 안에** 담긴 경우"로 한정 | "최종 사용자가 모델에 접근하지 못하게 상업적으로 합리적인 조치(암호화, 보호된 리소스 파일 등)"가 **의무**. 브라우저에 glTF를 그대로 내려보내면 추출이 쉬워 **위반 소지가 큼** | "Editorial" 표시 모델은 뉴스·보도 용도만 가능 → 게임에 사용 불가 |
| Fab Standard ([라이선스](https://www.fab.com/eula)) | 가능. "에셋을 포함한 프로젝트를 상업적으로 배포", 수정 허용 | 단독 파일로 재배포·무료 배포 금지. 암호화 의무 문구는 없음 → **웹 사용에 가장 무난** | 출처 표기 의무 없음(포럼 답변 기준, 원문 미확인) |
| Sketchfab Store Standard ([라이선스](https://sketchfab.com/licenses)) | "Reproduce"(배포·2차 저작 포함) 허용, 단 단독 파일 제공 금지 | 파일 보호(무단 접근 방지) 조항 있음 → CGTrader보다는 약하지만 주의 필요 | Editorial은 상업 이용 불가 |

### 5.2 후보

| 후보 | 형식 | 동작 | 가격 (조회 시점) | 라이선스 | 판단 |
|---|---|---|---|---|---|
| **[Cats - Simple (Radik Bilalov, Fab)](https://www.fab.com/listings/4fa9591d-945e-41be-b37b-b39e4539602a)** | FBX, OBJ, **glTF/GLB**, USDZ, Blender | **100개 이상**: 걷기·속보·달리기, 앉기 대기 1~3, 핥기, 귀 긁기, 엎드리기 2종, **배 보이고 눕기 3종**, 잠·배 보이고 잠, 먹기·마시기, 점프 | 약 40,700원 | Fab Standard (라이선스 선택 항목은 페이지에서 확인 못 함) | **1순위.** 동작이 지금 행동 목록과 거의 맞고 glTF 제공. 일반 귀라 접힌 귀는 Blender로 수정 필요. 11.4k 삼각형 + 모바일용 2.35k |
| [Animalia - Domestic Cat (GiM, Fab)](https://www.fab.com/listings/f2e3ef1b-bc1d-4dd4-9638-e72b1a29241b) | Unreal, Unity, Maya·3ds Max 리그 (**glTF 표기 없음**) | 60개 이상(60fps), 4K 텍스처, 털(gFur 지원) | 약 122,000원 | Fab | 품질은 가장 높아 보이나 웹 변환 작업과 비용 부담. 2순위 |
| [Chibi cat Scottish Fold (CGTrader)](https://www.cgtrader.com/3d-models/animal/mammal/chibi-cat-scottish-fold) | Blender, FBX | 걷기·앉기·먹기·자기 등 | $20 | **Editorial, No AI** | 접힌 귀지만 **Editorial이라 게임 사용 불가**. 치비 스타일도 맞지 않음 |
| [Orange Scottish Fold (CGTrader)](https://www.cgtrader.com/3d-models/animal/mammal/orange-scottish-fold-cat) | .blend (약 65MB) | idle 1개 | $50 | Royalty Free | 접힌 귀지만 동작이 거의 없고, CGTrader 웹 추출 방지 의무 문제 |
| [Cat Rigged & Animated Low Poly (3D_Tech, Sketchfab→Fab)](https://sketchfab.com/3d-models/cat-rigged-animated-low-poly-7510ec711d204b5788262c6d5eb678ed) | 미표기 | 10개 (걷기, 앉아 대기, 먹기 등. 눕기 없음) | 미표기 | 미표기 | 눕기 동작 없음 → 제외 |

### 5.3 정리와 남은 확인 사항
1. 웹 배포 조건을 보면 **Fab Standard 라이선스 모델이 가장 무난하다.** CGTrader Royalty Free는 브라우저 배포 시 추출 방지 의무 때문에 위험하다.
2. 접힌 귀 + 충분한 동작 + 웹 사용 가능 라이선스를 모두 갖춘 모델은 찾지 못했다. 1순위 후보를 사면 **귀를 직접 수정**해야 한다(Fab Standard는 수정 허용).
3. 구매 전 확인 필요: Fab 라이선스 선택 항목(개인/전문가 구분, 매출 기준), 모델 페이지의 개별 제한, 판매자에게 웹(three.js) 배포 가능 여부 문의.
4. 리깅 모델로 바꾸면 `CatRig` 인터페이스 뒤에 `SkinnedCatRig`를 새로 만들고, 지금의 자세 값(`CatPose`)을 애니메이션 클립 혼합으로 옮긴다. 행동·자세 시스템은 그대로 쓴다.

## 6. 고양이 기준 모델: 캐릭터.glb (2026-11-06, D-31)

| 항목 | 내용 |
|---|---|
| 저장소 파일 | `web/public/assets/models/cat.glb` (원본 `_box/blender/캐릭터.glb`를 **수정하지 않고** 이름만 바꿔 복사) |
| 원본 | Sketchfab "Toon Cat FREE" — https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386 |
| 제작자 | Omabuarts Studio (https://sketchfab.com/omabuarts) |
| 라이선스 | **CC BY 4.0** (Sketchfab 원본 페이지·glb 메타데이터 표기). **출처 표기 필수.** 상업적 배포 가능 여부는 확인 전 (`CREDITS.md`) |
| 앱 안 출처 표기 | 설정 창 출처 영역 + 정보 페이지(`info.html`) "출처·라이선스" (2026-11-07, D-34) |
| 구성 | 메시 1개(정점 1,810), 뼈 36개(몸통·척추 2·목·머리·귀 2·입·눈 2·다리 4×3~4·꼬리 5·IK 보조 5), 텍스처 64×64 그라데이션 팔레트 1장, 동작 1개(0.83초 달리기, 사용 안 함) |
| 쓰는 방법 | 파일의 기본 자세는 달리는 중간 자세라, 역바인드 행렬로 기준 자세(서 있음)를 복원한 뒤 코드로 뼈를 움직인다 (`web/src/cat/SkinnedCatRig.ts`). 모델 단위 × 0.12 = 성체 m |
| 무늬 | 팔레트 텍스처로는 무늬를 그릴 수 없어, 기준 자세의 정점 위치로 부위(몸통·다리·꼬리·머리·가슴·배·발·주둥이·눈)를 나누고 셰이더에서 칠한다 (`web/src/cat/catSkin.ts`). 귀 안쪽·코·입은 원본 색 |

### 6.1 모델 분석 값 (셰이더·자세 기준, 모델 단위, y 위·z 앞)
- 눈: 중심 (±0.345, 2.857, 1.99), 반지름 약 0.115인 둥근 사각형 판. 원 바깥 모서리는 털색으로 칠한다.
- 엉덩이 관절 높이 1.398, 어깨 1.26, 발 0.09, 배 아래 0.72, 등 위 약 3.06(머리 포함), 몸통 반폭 0.83.
- 꼬리 뿌리 z −1.285, 꼬리 끝 z −3.37. 텍스처 u < 0.283은 털, u 0.75~0.875·v < 0.4는 주둥이, 그 아래는 코·입, u > 0.875는 눈.
- 발바닥(y < 0.012): 앞발 x ±0.29~0.545, z 0.925~1.283 (가운데 ±0.418, 1.104), 뒷발 x ±0.438~0.638, z −1.038~−0.586 (가운데 ±0.538, −0.812). 셰이더가 이 좌표 안에 패드를 그린다 (D-42, 2026-11-07 게임 안 정점 측정).

### 6.2 달리기 동작: Run.blend → cat-run.glb (2026-11-07, D-33)
| 항목 | 내용 |
|---|---|
| 원본 | `_box/blender/motion/Run.blend` (사용자 제공): 회색 로우폴리 고양이(정점 398, 뼈 27개)와 달리기(갤럽) 동작 1개(36프레임, 24fps = 1.5초, 제자리 동작) |
| 출처·라이선스 | 원본: Sketchfab "Lowpoly Cat Rig + Run Animation" — Daily Lowpoly, **CC BY 4.0** (2019-10-30 공개). 내려받은 곳: Free3D "Lowpoly Cat Rigged Run Animation" — **Personal Use License**(사용자 확인 정보, 자동 확인은 접근 거부). **두 조건이 달라 실제 사용 권한이 확인될 때까지 상업적으로 배포하지 않는다.** 상세: `CREDITS.md` |
| 저장소 파일 | `web/public/assets/models/cat-run.glb` (43KB): 원본은 수정하지 않고 Blender 5.4(명령줄)로 **뼈대와 동작만** 내보냄(메시 제외, 기준 자세 = 편집 자세, Y 위) |
| 쓰는 방법 | 실행 중에 원본 뼈가 기준 자세에서 돈 만큼을 glb 고양이 뼈에 준다 (`web/src/cat/runRetarget.ts`). 좌표 맞춤: 원본 앞 +X·왼쪽 −Z → 모델 앞 +Z·왼쪽 +X (y축 −90°). 뼈 짝: 골반→몸통, 등 1·2→척추 1·2, 앞다리 1~3→위팔·아래팔·발, 뒷다리 1~4→허벅지·정강이·발목·발, 꼬리 1~4→꼬리 1~4. 귀·머리·목은 코드 자세(시선 유지) |
| 측정 | 한 주기에 약 0.78m 전진(성체), 달리기 1.4m/s에서 다리 약 1.9회/초. 원본은 공중에 뜬 구간이 길어, 가장 낮은 발이 뜬 높이의 75%만큼 몸을 내린다 |

### 6.3 누운 자세: cat-poses.glb (2026-11-07, D-44)
- 직접 만든 자세 파일. `cat.glb` 뼈대를 Blender 5.4(명령줄)로 불러와 뼈를 돌려 자세를 잡고, 메시를 빼고 뼈대·자세만 glb로 내보냄 (55KB).
- 동작 5개 (2026-11-08 식빵 `loafPose`·낮잠 `napPose`·꼬리 감기 `wrapPose` 추가: 앞발을 가슴 밑에 접기 / 앞발을 앞으로 뻗고 고개 기대기 / 몸을 말고 고개 묻기. 다리는 `aim()`으로 옆에서 본 뼈 방향을 지정). 처음 2개: `bellyUp`(배 보이기: 등을 대고 C자로 휘고, 앞발은 가슴 쪽으로 오므리고, 뒷다리는 개구리처럼 벌리고, 얼굴은 거꾸로 하늘), `sideLie`(옆으로 눕기: 옆구리를 대고 머리를 뉘고, 앞다리는 앞으로·뒷다리는 뒤로 편하게).
- 자세에 쓰는 뼈: 몸통·척추 2·목·머리·네 다리(19개). Blender 축 메모: 고양이 기준 L(왼쪽)축 둘레 +각도는 옆에서 볼 때 시계 방향(앞을 향한 것은 숙이고, 늘어진 다리는 뒤로). 꼬리·귀·눈·입은 코드.
- 불러오기 옵션: 기본 옵션은 메시가 뭉개진다. `guess_original_bind_pose=False`, `bone_heuristic='TEMPERANCE'`로 불러오고, 파일에 든 걷기 동작 연결은 지운다.
- 원본 모델(Toon Cat FREE, CC BY 4.0)의 뼈대를 쓰므로 `CREDITS.md` 1장 수정 내역에 기록.
- 자세 스크립트: `tools/blender/poses.py`(자세)·`posekit.py`(공통 도구). 실행 방법은 `tools/blender/README.md`. 저장소에서 다시 실행하면 지금 파일과 같은 glb가 나온다 (2026-11-07 확인).

### 6.4 포즈 메뉴 실루엣: assets/ui/poses/*.png (2026-11-09, D-55)
- 직접 만든 그림. 게임 고양이(`cat.glb`, 기본 성체·선 귀)를 자세마다 옆에서 검은 재질로 렌더하고, 밝기를 투명도로 바꿔 잘라낸 128×112 PNG 8장(각 3~5KB). 꼬리 감기는 꼬리가 감긴 반대쪽 옆에서 찍고 좌우를 뒤집는다(`back`).
- 만드는 스크립트: `tools/pose-icons/capture.mjs` (개발 서버가 켜져 있을 때 `node tools/pose-icons/capture.mjs`). 헤드리스 Chrome으로 게임을 열어 `doPose`로 자세를 취하게 한 뒤 찍는다.
- 원본 모델(Toon Cat FREE, CC BY 4.0)의 모양을 쓰므로 출처 표기는 기준 모델과 같다.

## 6.5 골목 소품 모델: Polyfork (2026-11-09, D-56 시범)
- 출처·라이선스·모델별 페이지: `CREDITS.md` 6장 (CC BY 4.0, polyfork.dev/licensing 확인).
- 파일: `web/public/assets/models/props/*.glb` 12개, 합계 약 1.2MB. 텍스처·압축 없음, 재질 1개, 정점 색(COLOR_0), 미터 단위.
- 코드: `web/src/world/propModels.ts` (목록·축척 `PROP_SPECS`, 굽기 `bakeModel`, 윗면 높이 `topAt`), 배치는 `MapKit.prop`.
- 후보를 고른 과정: `catalog.json`에서 골목용 20개 → 시범 12개 (외부 계단·블록 담·편의점·셔터·전봇대는 미룸).
- 공원 (2026-11-10, D-58): Nature & Forest 키트 후보 20개 → 13개(파일). 합계 약 0.84MB, 소품 폴더 전체 25개 약 1.9MB.

## 7. 문의 창 고양이: Black Cat (2026-11-07, D-34)
- Sketchfab "Black Cat" — Kinga Kroliczek, CC BY 4.0 (2023-10-16 공개, API·glb 메타데이터로 확인). 뼈대·동작 없는 정지 모델(메시 6개, 텍스처 1장).
- `_box/blender/black_cat.glb`를 수정하지 않고 `web/public/assets/models/black-cat.glb`로 복사. 정보 페이지 문의 창에서만 쓰고, 3D는 창을 열 때만 불러온다.
- 상세 출처·수정 내역: `CREDITS.md` 3장.

