/**
 * 외부 에셋 출처·라이선스 (한 곳에서 관리).
 * 정보 페이지(info.html)가 이 데이터로 출처 화면을 만들고, 프로젝트 루트 CREDITS.md는 같은 내용을 담는다.
 * 둘이 어긋나지 않는지는 tests/credits.test.ts가 확인한다.
 *
 * 상업적 배포: 사용 권한이 확인되기 전까지 모든 항목을 'unconfirmed'로 둔다 (사용자 지시 2026-11-07).
 */
export interface Credit {
  id: string;
  /** 무엇에 쓰는지 */
  role: string;
  name: string;
  author: { name: string; url?: string };
  /** 원본(제작자가 올린) 페이지 */
  sourceUrl: string;
  /** 실제로 내려받은 페이지 */
  downloadUrl: string;
  license: { name: string; url?: string; note?: string };
  /** 저장소 안에서 쓰는 파일 */
  files: string[];
  /** 수정·변환 내역 */
  changes: string[];
  /** 상업적 배포 가능 여부 */
  commercial: 'unconfirmed';
}

export const CREDITS: Credit[] = [
  {
    id: 'toon-cat',
    role: '고양이 3D 모델 (모든 고양이 캐릭터의 기준 모델)',
    name: 'Toon Cat FREE',
    author: { name: 'Omabuarts Studio', url: 'https://sketchfab.com/omabuarts' },
    sourceUrl: 'https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386',
    downloadUrl: 'https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386',
    license: {
      name: 'CC BY 4.0 (Creative Commons Attribution)',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.ko',
      note: 'Sketchfab 원본 페이지 표기 기준 (2016-06-29 공개). 짧은 링크: https://skfb.ly/6TKrP',
    },
    files: ['web/public/assets/models/cat.glb', 'web/public/assets/models/cat-poses.glb'],
    changes: [
      '파일 자체는 수정하지 않고 이름만 바꿈 (캐릭터.glb → cat.glb)',
      '게임 안에서 뼈를 코드로 움직여 자세·포즈를 만듦 (파일에 든 걷기 동작은 걸음에 맞춰 재생)',
      '털색·무늬·눈 색을 셰이더로 다시 칠함 (원본 그라데이션 텍스처 대신)',
      '체형 조절을 위해 몸통을 셰이더로 부풀리고, 털 겹(shell fur)을 덧씌움',
      '접힌 귀, 아기 비율, 목걸이 등 외형 옵션을 코드로 더함',
      '같은 뼈대로 Blender 5.4에서 누운 자세(배 보이기·옆으로 눕기)를 잡아 뼈대·자세만 cat-poses.glb로 내보냄 (메시·텍스처 없음)',
      '풍선 이스터 에그에서 몸통을 셰이더로 공 모양으로 둥글게 만듦',
    ],
    commercial: 'unconfirmed',
  },
  {
    id: 'run-cat',
    role: '달리기 동작 (뼈대와 동작만 사용)',
    name: 'Lowpoly Cat Rig + Run Animation',
    author: { name: 'Daily Lowpoly', url: 'https://sketchfab.com/dailyfree3d' },
    sourceUrl: 'https://sketchfab.com/3d-models/lowpoly-cat-rig-run-animation-c36df576c9ae4ed28e89069b1a2f427a',
    downloadUrl: 'https://free3d.com/3d-model/lowpoly-cat-rigged-run-animation-756268.html',
    license: {
      name: 'CC BY 4.0 (원본 Sketchfab) / Personal Use License (내려받은 Free3D 페이지)',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.ko',
      note: '원본 Sketchfab 페이지(2019-10-30 공개)는 CC BY 4.0, 실제로 내려받은 Free3D 페이지는 Personal Use License로 조건이 다르다. 실제 사용 권한이 확인될 때까지 상업적으로 배포하지 않는다.',
    },
    files: ['web/public/assets/models/cat-run.glb'],
    changes: [
      '원본 Run.blend를 Blender 5.4로 변환: 메시는 빼고 뼈대와 달리기 동작(36프레임, 1.5초)만 glb로 내보냄 → cat-run.glb',
      '게임 안에서 달리기 동작을 Toon Cat FREE 뼈대로 옮겨 씀 (뼈 짝짓기, 좌표 방향 맞춤, 몸 높이 보정)',
    ],
    commercial: 'unconfirmed',
  },
  {
    id: 'groom-cat',
    role: '그루밍 동작 (뼈대와 동작만 사용)',
    name: 'An Animated Cat',
    author: { name: 'Evil_Katz', url: 'https://sketchfab.com/Evil_Katz' },
    sourceUrl: 'https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8',
    downloadUrl: 'https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8',
    license: {
      name: 'CC BY 4.0 (Creative Commons Attribution)',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.ko',
      note: 'Sketchfab 원본 페이지·glb 메타데이터 표기 기준 (2021-02-11 공개)',
    },
    files: ['web/public/assets/models/cat-groom.glb'],
    changes: [
      '원본 grumming.glb(사용자 제공)를 Blender 5.4로 변환: 메시·텍스처는 빼고 뼈대와 그루밍 동작(6초)만 glb로 내보냄 → cat-groom.glb',
      '게임 안에서 그루밍 동작을 Toon Cat FREE 뼈대로 옮겨 씀 (뼈 짝짓기, 목·머리는 회전의 50~60%만, 귀는 쓰지 않음, 앉은 높이 보정)',
    ],
    commercial: 'unconfirmed',
  },
  {
    id: 'black-cat',
    role: '정보 페이지 문의 창의 검은 고양이',
    name: 'Black Cat',
    author: { name: 'Kinga Kroliczek', url: 'https://sketchfab.com/kinga_kroliczek' },
    sourceUrl: 'https://sketchfab.com/3d-models/black-cat-4e001843d9774d7eb5e48d59f2bf14f5',
    downloadUrl: 'https://sketchfab.com/3d-models/black-cat-4e001843d9774d7eb5e48d59f2bf14f5',
    license: {
      name: 'CC BY 4.0 (Creative Commons Attribution)',
      url: 'https://creativecommons.org/licenses/by/4.0/deed.ko',
      note: 'Sketchfab 원본 페이지·glb 메타데이터 표기 기준 (2023-10-16 공개)',
    },
    files: ['web/public/assets/models/black-cat.glb'],
    changes: ['파일 자체는 수정하지 않고 이름만 바꿈 (black_cat.glb → black-cat.glb)', '문의 창에서 숨쉬기·좌우로 살랑이는 움직임을 코드로 더함'],
    commercial: 'unconfirmed',
  },
  {
    id: 'meow-sounds',
    role: '고양이 울음소리 6개',
    name: '고양이 울음소리 효과음',
    author: { name: '-라일락-' },
    sourceUrl: 'https://pgtd.tistory.com/127',
    downloadUrl: 'https://pgtd.tistory.com/127',
    license: { name: 'CC BY 4.0 (Creative Commons Attribution)', url: 'https://creativecommons.org/licenses/by/4.0/deed.ko' },
    files: ['web/public/assets/sounds/meow-*.mp3', 'web/public/assets/sounds/kitten-meow-*.mp3'],
    changes: ['파일은 수정하지 않고 이름만 바꿈', '재생할 때 음량(LUFS 기준)과 앞부분 무음을 조정함'],
    commercial: 'unconfirmed',
  },
];

/** 외부 출처가 아닌 것 (출처 화면에 함께 안내) */
export const OWN_ASSETS: string[] = [
  '골골송 녹음 2개: 사용자가 직접 녹음 (web/public/assets/sounds/purr-*.m4a)',
  '동네 건물·소품·바닥 텍스처, 바람·새소리 등: 코드로 생성',
];

/** 정보 페이지 시행일 */
export const INFO_EFFECTIVE_DATE = '2026-11-07';
