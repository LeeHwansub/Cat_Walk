# 에셋 및 라이선스 기록

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

골골송 녹음 파일은 매우 작게 녹음되어(최대 -19~-21dB) 증폭 상한을 10배로 따로 두고, 재생할 때 1.8kHz 저역 통과 필터로 고음 잡음을 줄인다. 메타데이터상 안드로이드 휴대폰 녹음이다(com.android.version=14).

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
