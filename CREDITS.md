# CREDITS — 출처와 라이선스

Cat Walk에서 쓰는 외부 에셋의 출처·라이선스·수정 내역이다.

- 게임 안에서는 **정보 페이지**(`web/info.html`)의 "출처·라이선스"에서 같은 내용을 볼 수 있다. 시작 화면·게임 화면의 **i** 버튼이나 설정 창의 "정보·출처" 링크로 연다.
- 데이터 원본은 `web/src/info/credits.ts`다. 이 문서와 어긋나지 않는지는 `web/tests/credits.test.ts`가 확인한다. 항목을 바꾸면 두 곳을 함께 고친다.

> **상업적 배포 가능 여부: 확인 전.**
> 달리기 동작 모델은 원본 Sketchfab 페이지(CC BY 4.0)와 실제로 내려받은 Free3D 페이지(Personal Use License)의 조건이 다르다.
> 실제 사용 권한이 확인될 때까지 이 프로젝트를 상업적으로 배포하지 않으며, 어떤 에셋에도 상업적 배포 허용 표시를 하지 않는다.

---

## 1. 고양이 3D 모델 — Toon Cat FREE

| 항목 | 내용 |
|---|---|
| 용도 | 모든 고양이 캐릭터의 기준 모델 |
| 모델명 | Toon Cat FREE |
| 제작자 | Omabuarts Studio (https://sketchfab.com/omabuarts) |
| 원본 URL | https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386 (짧은 링크 https://skfb.ly/6TKrP) |
| 다운로드 URL | https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386 (Sketchfab에서 glb로 받음, 파일 안 생성기 표기 `Sketchfab-12.66.0`) |
| 라이선스 | CC BY 4.0 (Creative Commons Attribution) — https://creativecommons.org/licenses/by/4.0/ (Sketchfab 원본 페이지 표기, 2016-06-29 공개) |
| 상업적 배포 | 확인 전 |
| 저장소 파일 | `web/public/assets/models/cat.glb` (원본 파일명 `캐릭터.glb`), `web/public/assets/models/cat-poses.glb` (이 모델 뼈대로 만든 누운 자세) |

### 수정 내역
- 파일 자체는 수정하지 않고 이름만 바꿈 (`캐릭터.glb` → `cat.glb`).
- 게임 안에서 뼈를 코드로 움직여 자세·포즈를 만듦. 파일에 든 걷기 동작은 걸음에 맞춰 재생.
- 털색·무늬·눈 색을 셰이더로 다시 칠함 (원본 그라데이션 텍스처 대신).
- 체형 조절을 위해 몸통을 셰이더로 부풀리고, 털 겹(shell fur)을 덧씌움.
- 접힌 귀, 아기 비율, 목걸이 등 외형 옵션을 코드로 더함.
- 같은 뼈대로 Blender 5.4에서 누운 자세(배 보이기·옆으로 눕기·식빵·낮잠·꼬리 감기)를 잡아 **뼈대·자세만** `cat-poses.glb`로 내보냄 (메시·텍스처 없음, 2026-11-07).
- 풍선 이스터 에그에서 몸통을 셰이더로 공 모양으로 둥글게 만듦.
- 눈을 셰이더로 다시 그림 (크고 동그란 동공, 반짝임 두 개). 그루밍·밥 먹기 때 내미는 혀를 코드로 더함 (2026-11-08).

## 2. 달리기 동작 — Lowpoly Cat Rig + Run Animation

| 항목 | 내용 |
|---|---|
| 용도 | 달리기 동작 (뼈대와 동작만 사용, 모양은 쓰지 않음) |
| 모델명 | Lowpoly Cat Rig + Run Animation (Free3D 표기: Lowpoly Cat Rigged Run Animation) |
| 제작자 | Daily Lowpoly (https://sketchfab.com/dailyfree3d) |
| 원본 URL | https://sketchfab.com/3d-models/lowpoly-cat-rig-run-animation-c36df576c9ae4ed28e89069b1a2f427a (2019-10-30 공개) |
| 다운로드 URL | https://free3d.com/3d-model/lowpoly-cat-rigged-run-animation-756268.html |
| 라이선스 | CC BY 4.0 (원본 Sketchfab) / Personal Use License (내려받은 Free3D 페이지) |
| 라이선스 비고 | 원본 Sketchfab 페이지는 CC BY 4.0, 실제로 내려받은 Free3D 페이지는 Personal Use License로 **조건이 다르다.** Free3D 페이지는 자동 확인이 막혀 있어(접근 거부) 라이선스 표기는 사용자 확인 정보다. |
| 상업적 배포 | 확인 전 — 실제 사용 권한이 확인될 때까지 상업적으로 배포하지 않음 |
| 저장소 파일 | `web/public/assets/models/cat-run.glb` (원본 `Run.blend`) |

### 수정 내역
- 원본 `Run.blend`를 Blender 5.4(명령줄)로 변환: 메시는 빼고 **뼈대와 달리기 동작(36프레임, 24fps, 1.5초)만** glb로 내보냄 → `cat-run.glb`. 원본 `.blend` 파일은 수정하지 않음.
- 게임 안에서 달리기 동작을 Toon Cat FREE 뼈대로 옮겨 씀: 뼈 짝짓기(골반·등·다리·꼬리), 좌표 방향 맞춤(y축 −90°), 몸 높이 보정(공중에 뜬 높이를 줄임).

## 3. 그루밍 동작 — An Animated Cat

| 항목 | 내용 |
|---|---|
| 용도 | 그루밍 동작 (앉아서 앞발 핥기·얼굴 닦기, 뼈대와 동작만 사용) |
| 모델명 | An Animated Cat |
| 제작자 | Evil_Katz (https://sketchfab.com/Evil_Katz) |
| 원본 URL | https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8 (2021-02-11 공개) |
| 다운로드 URL | https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8 (Sketchfab에서 glb로 받음, 생성기 표기 `Sketchfab-12.66.0`, 사용자 제공 파일명 `grumming.glb`) |
| 라이선스 | CC BY 4.0 (Creative Commons Attribution) — https://creativecommons.org/licenses/by/4.0/ (원본 페이지·glb 메타데이터 표기) |
| 상업적 배포 | 확인 전 |
| 저장소 파일 | `web/public/assets/models/cat-groom.glb` |

### 수정 내역
- 원본 `grumming.glb`를 Blender 5.4(명령줄)로 변환: 메시·텍스처는 빼고 **뼈대와 그루밍 동작(144프레임, 24fps, 6초)만** glb로 내보냄 → `cat-groom.glb` (3.2MB → 183KB). 원본 파일은 수정하지 않음.
- 게임 안에서 그루밍 동작을 Toon Cat FREE 뼈대로 옮겨 씀: 뼈 짝짓기(몸통·척추·목·머리·턱·다리·꼬리), 목·머리는 회전의 50~60%만(큰 머리가 가슴에 파묻히지 않게), 귀는 쓰지 않음(접힌 귀 유지), 앉은 엉덩이·발이 땅에 닿게 높이 보정.

## 4. 문의 창 고양이 — Black Cat

| 항목 | 내용 |
|---|---|
| 용도 | 정보 페이지 "문의하기" 창에서 "무엇을 문의하러 오셨냐옹?"이라고 묻는 검은 고양이 |
| 모델명 | Black Cat |
| 제작자 | Kinga Kroliczek (https://sketchfab.com/kinga_kroliczek) |
| 원본 URL | https://sketchfab.com/3d-models/black-cat-4e001843d9774d7eb5e48d59f2bf14f5 (2023-10-16 공개) |
| 다운로드 URL | https://sketchfab.com/3d-models/black-cat-4e001843d9774d7eb5e48d59f2bf14f5 (Sketchfab에서 glb로 받음, 생성기 표기 `Sketchfab-15.40.0`) |
| 라이선스 | CC BY 4.0 (Creative Commons Attribution) — https://creativecommons.org/licenses/by/4.0/ (원본 페이지·glb 메타데이터 표기) |
| 상업적 배포 | 확인 전 |
| 저장소 파일 | `web/public/assets/models/black-cat.glb` (원본 파일명 `black_cat.glb`) |

### 수정 내역
- 파일 자체는 수정하지 않고 이름만 바꿈 (`black_cat.glb` → `black-cat.glb`).
- 문의 창에서 숨쉬기·좌우로 살랑이는 움직임을 코드로 더함 (뼈대가 없는 정지 모델).

## 5. 고양이 울음소리 — 효과음

| 항목 | 내용 |
|---|---|
| 용도 | 고양이 울음소리 6개 (일반 3, 궁금, 배고픔, 새끼) |
| 제작자 | -라일락- |
| 원본 URL | https://pgtd.tistory.com/127 |
| 다운로드 URL | https://pgtd.tistory.com/127 |
| 라이선스 | CC BY 4.0 (Creative Commons Attribution) — https://creativecommons.org/licenses/by/4.0/ |
| 상업적 배포 | 확인 전 |
| 저장소 파일 | `web/public/assets/sounds/meow-*.mp3`, `kitten-meow-1.mp3` |

### 수정 내역
- 파일은 수정하지 않고 이름만 바꿈 (`docs/ASSETS.md` 1.1에 원본 파일명 대응표).
- 재생할 때 음량(LUFS 기준)과 앞부분 무음을 조정함.

## 6. 골목 소품 모델 — Polyfork 무료 로우폴리 모델

| 항목 | 내용 |
|---|---|
| 용도 | 골목 소품 12종: 차(해치백·경차 밴), 바닥 실외기, 화분, 가로등, 계량기 함, 배달 오토바이, 자전거, 자판기, 쓰레기통, 음료 상자, 고깔 (2026-11-09 시범, D-56). 공원 13종: 참나무·단풍나무·자작나무, 둥근 덤불, 나무 벤치, 돌 2종, 들꽃, 풀 포기, 고사리, 가로등, 새집 기둥, 쓰러진 통나무 (2026-11-10, D-58) |
| 모델명 | Polyfork 무료 로우폴리 모델 (Little Tokyo·New York City·Nature & Forest 키트) |
| 제작자 | Polyfork (Lucas Martinic) (https://polyfork.dev) |
| 원본 URL | https://polyfork.dev/kit/japanese-suburban-city-street-baa482 (모델별 페이지는 아래 표) |
| 다운로드 URL | https://github.com/lucas-martinic/polyfork-catalog (목록의 glb 링크로 받음) |
| 라이선스 | CC BY 4.0 (Creative Commons Attribution) — https://creativecommons.org/licenses/by/4.0/ (https://polyfork.dev/licensing, 2026-11-09 확인. 출처 표기 없이 쓰는 Polyfork 라이선스도 있으나 이 프로젝트는 CC BY로 표기한다. 모델 파일만 따로 재배포·판매 금지, 상업용 3D 생성 AI 학습 금지) |
| 상업적 배포 | 확인 전 |
| 저장소 파일 | `web/public/assets/models/props/*.glb` |

| 파일 | 모델 | 원본 페이지 |
|---|---|---|
| `compact-hatchback.glb` | Compact Hatchback | https://polyfork.dev/asset/compact-hatchback-386417 |
| `kei-van.glb` | Kei Van | https://polyfork.dev/asset/kei-van-211ed5 |
| `air-con-unit.glb` | Air-Con Unit | https://polyfork.dev/asset/air-con-unit-9fadc2 |
| `potted-shrub.glb` | Potted Shrub | https://polyfork.dev/asset/potted-shrub-43bd21 |
| `street-lamp.glb` | Street Lamp | https://polyfork.dev/asset/street-lamp-29f365 |
| `meter-box.glb` | Meter Box | https://polyfork.dev/asset/meter-box-1e6e42 |
| `delivery-moped.glb` | Delivery Moped | https://polyfork.dev/asset/delivery-moped-1aa2ce |
| `city-bicycle.glb` | City Bicycle | https://polyfork.dev/asset/city-bicycle-5b67d1 |
| `vending-machine.glb` | Vending Machine | https://polyfork.dev/asset/vending-machine-471c29 |
| `street-bin.glb` | Street Bin | https://polyfork.dev/asset/street-bin-770173 |
| `beverage-crate.glb` | Beverage Crate | https://polyfork.dev/asset/beverage-crate-c195c9 |
| `traffic-cone.glb` | Traffic Cone | https://polyfork.dev/asset/traffic-cone-247748 |
| `oak-tree.glb` | Broadleaf Oak | https://polyfork.dev/asset/broadleaf-oak-997c22 |
| `maple-tree.glb` | Maple Tree | https://polyfork.dev/asset/maple-tree-65fa12 |
| `birch-tree.glb` | Birch Tree | https://polyfork.dev/asset/birch-tree-181b33 |
| `round-bush.glb` | Round Bush | https://polyfork.dev/asset/round-bush-cd2ac0 |
| `wooden-bench.glb` | Wooden Bench | https://polyfork.dev/asset/wooden-bench-02e2c8 |
| `medium-rock.glb` | Medium Rock | https://polyfork.dev/asset/medium-rock-e08405 |
| `small-rock.glb` | Small Rock | https://polyfork.dev/asset/small-rock-db33a7 |
| `wildflower.glb` | Wildflower | https://polyfork.dev/asset/wildflower-68d3a1 |
| `grass-tuft.glb` | Grass Tuft | https://polyfork.dev/asset/grass-tuft-a40a08 |
| `fern-plant.glb` | Fern Plant | https://polyfork.dev/asset/fern-plant-1559b8 |
| `lantern-post.glb` | Lantern Post | https://polyfork.dev/asset/lantern-post-f47665 |
| `birdhouse-post.glb` | Birdhouse Post | https://polyfork.dev/asset/birdhouse-post-66d6c1 |
| `fallen-log.glb` | Fallen Log | https://polyfork.dev/asset/fallen-log-1685fb |

### 수정 내역
- 파일 자체는 수정하지 않고 이름만 바꿈 (끝의 id를 뗌).
- 게임에서 불러올 때 메시를 하나로 합치고(정점 색 유지), 바닥 기준점·축척을 맞춤.

## 7. 직접 만든 것 (외부 출처 없음)
- 골골송 녹음 2개: 사용자가 직접 녹음 (`web/public/assets/sounds/purr-*.m4a`).
- 동네 건물·소품·바닥 텍스처, 바람·새소리 등: 코드로 생성.

## 변경 기록
| 날짜 | 내용 |
|---|---|
| 2026-11-07 | 문서 작성. Toon Cat FREE, Lowpoly Cat Rig + Run Animation, 울음소리 효과음 기록 |
| 2026-11-07 | Black Cat(문의 창) 추가 |
| 2026-11-07 | An Animated Cat(그루밍 동작) 추가 |
| 2026-11-10 | Polyfork 공원 모델 13종 추가 (Nature & Forest 키트) |
| 2026-11-09 | Polyfork 골목 소품 모델 12종 추가 (시범). An Animated Cat(그루밍 동작)은 쓰지 않게 됨 (D-55, 파일은 남김) |
