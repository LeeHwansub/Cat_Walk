/**
 * 누운 자세 (배 보이기·옆으로 눕기·식빵·낮잠·꼬리 감기). Blender에서 cat.glb 뼈대로 자세를 잡아
 * 뼈대·자세만 cat-poses.glb로 내보냈다 (2026-11-07, D-44). 코드로 몸통만 굴리던 자세가
 * 목이 꺾이고 다리가 막대처럼 뻗어 어색했다.
 */
export const CAT_POSES_FILE = 'cat-poses.glb';

/** 파일 안 동작 이름 = 자세 값 이름 (CatPose의 같은 이름). 식빵·낮잠·꼬리 감기는 2026-11-08 추가 (다리가 몸 밑에 묻혀 보이던 것) */
export const LIE_POSES = ['bellyUp', 'sideLie', 'loafPose', 'napPose', 'wrapPose'] as const;
export type LiePose = (typeof LIE_POSES)[number];

/** 점프 자세 (J-2): 웅크리기 · 도약 · 공중 · 착지. 같은 파일·같은 뼈를 쓴다 (tools/blender/poses.py) */
export const JUMP_POSES = ['jumpCrouch', 'jumpLaunch', 'jumpAir', 'jumpLand'] as const;
export type JumpPose = (typeof JUMP_POSES)[number];

/** 자세에 쓰는 뼈. 꼬리·귀·눈·입은 넣지 않는다 (꼬리 흔들기·귀 움찔·눈 깜빡임은 코드가 계속 한다) */
export const LIE_POSE_BONES = [
  'torso_02',
  'spine.01_012',
  'spine.02_013',
  'neck_017',
  'head_018',
  'leg.upper.F.L_014',
  'leg.lower.FL_015',
  'foot.F.L_016',
  'leg.upper.F.R_024',
  'leg.lower.F.R_00',
  'foot.F.R_025',
  'thigh.B.L_03',
  'leg.upper.B.L_04',
  'leg.lower.B.L_05',
  'foot.B.L_06',
  'thigh.B.R_026',
  'leg.upper.B.R_027',
  'leg.lower.B.R_028',
  'foot.B.R_029',
] as const;
