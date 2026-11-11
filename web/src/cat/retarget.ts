import * as THREE from 'three';

/**
 * 달리기 동작 원본: `_box/blender/motion/Run.blend`의 뼈대와 동작만 내보낸 `cat-run.glb`.
 * 고양이 모델(캐릭터.glb)과 뼈대가 달라(뼈 27개, 이름·마디 수 다름) 뼈를 짝지어 옮긴다.
 * [원본 뼈, 대상 뼈] — 앞다리 4번째(발가락)와 꼬리 끝은 짝이 없어 대상 쪽은 부모를 따라간다.
 */
/** [원본 뼈, 대상 뼈, 회전 적용 비율(기본 1)] */
export type BoneMapEntry = [string, string] | [string, string, number];

export const RUN_BONE_MAP: BoneMapEntry[] = [
  ['pelvis', 'torso_02'],
  ['body_1', 'spine.01_012'],
  ['body_2', 'spine.02_013'],
  ['leg_front_left_1', 'leg.upper.F.L_014'],
  ['leg_front_left_2', 'leg.lower.FL_015'],
  ['leg_front_left_3', 'foot.F.L_016'],
  ['leg_front_right_1', 'leg.upper.F.R_024'],
  ['leg_front_right_2', 'leg.lower.F.R_00'],
  ['leg_front_right_3', 'foot.F.R_025'],
  ['leg_back_left_1', 'thigh.B.L_03'],
  ['leg_back_left_2', 'leg.upper.B.L_04'],
  ['leg_back_left_3', 'leg.lower.B.L_05'],
  ['leg_back_left_4', 'foot.B.L_06'],
  ['leg_back_right_1', 'thigh.B.R_026'],
  ['leg_back_right_2', 'leg.upper.B.R_027'],
  ['leg_back_right_3', 'leg.lower.B.R_028'],
  ['leg_back_right_4', 'foot.B.R_029'],
  ['tail_1', 'tail_07'],
  ['tail_2', 'tail.01_08'],
  ['tail_3', 'tail.02_09'],
  ['tail_4', 'tail.03_010'],
];

/**
 * 그루밍 동작 원본: 사용자 제공 `grumming.glb` (Sketchfab "An Animated Cat", Evil_Katz, CC BY 4.0)의
 * 뼈대와 동작만 내보낸 `cat-groom.glb`. 앉아서 앞발을 핥고 얼굴을 닦는 6초 동작.
 * 머리·목·입까지 옮긴다 (그루밍은 고개 움직임이 핵심). 귀는 코드가 맡는다(접힌 귀 유지).
 * 원본 척추는 4마디라 2·4번만 짝짓는다.
 */
export const GROOM_BONE_MAP: BoneMapEntry[] = [
  ['j_body_00_12', 'torso_02'],
  ['j_spine_2_03_14', 'spine.01_012'],
  ['j_spine_4_05_16', 'spine.02_013'],
  // 이 모델은 머리가 커서 원본만큼 고개를 숙이면 가슴에 파묻힌다 → 회전을 일부만 쓴다
  ['j_neck_base_06_17', 'neck_017', 0.5],
  ['j_head_08_19', 'head_018', 0.6],
  ['j_jaw_09_20', 'mouth_021'],
  ['j_l_humerous_031_42', 'leg.upper.F.L_014'],
  ['j_l_elbow_032_43', 'leg.lower.FL_015'],
  ['j_l_wrist_033_44', 'foot.F.L_016'],
  ['j_r_humerous_037_48', 'leg.upper.F.R_024'],
  ['j_r_elbow_038_49', 'leg.lower.F.R_00'],
  ['j_r_wrist_039_50', 'foot.F.R_025'],
  ['j_l_femur_050_61', 'thigh.B.L_03'],
  ['j_l_knee_051_62', 'leg.upper.B.L_04'],
  ['j_l_ankle_052_63', 'leg.lower.B.L_05'],
  ['j_l_ball_053_64', 'foot.B.L_06'],
  ['j_r_femur_055_66', 'thigh.B.R_026'],
  ['j_r_knee_056_67', 'leg.upper.B.R_027'],
  ['j_r_ankle_057_68', 'leg.lower.B.R_028'],
  ['j_r_ball_058_69', 'foot.B.R_029'],
  ['j_tail_1_043_54', 'tail_07'],
  ['j_tail_2_044_55', 'tail.01_08'],
  ['j_tail_3_045_56', 'tail.02_09'],
  ['j_tail_4_046_57', 'tail.03_010'],
  ['j_tail_5_047_58', 'tail.end_011'],
];

/**
 * 원본 좌표(glTF로 내보낸 Blender 장면: 앞 +X, 위 +Y, 왼쪽 −Z) → 고양이 모델 좌표(앞 +Z, 위 +Y, 왼쪽 +X).
 * y축으로 −90° 돌리면 된다.
 */
export const RUN_ALIGN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');

/**
 * 다른 뼈대의 동작 옮기기: 원본 뼈가 기준 자세에서 돈 만큼(월드 기준 회전 차이)을
 * 좌표 방향만 맞춰 대상 뼈의 기준 자세에 그대로 준다. 길이·비율은 대상 모델 것을 쓴다.
 */
export class ClipRetarget {
  readonly duration: number;
  private readonly mixer: THREE.AnimationMixer;
  private readonly action: THREE.AnimationAction;
  private readonly src = new Map<string, { node: THREE.Object3D; restInv: THREE.Quaternion }>();
  private readonly pelvis: THREE.Object3D;
  /** 원본 높이 기준 뼈(골반·몸통)의 기준 높이 (원본 단위) */
  readonly pelvisRestY: number;
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly alignInv: THREE.Quaternion;
  private readonly identity = new THREE.Quaternion();

  constructor(
    private readonly scene: THREE.Object3D,
    clip: THREE.AnimationClip,
    private readonly map: BoneMapEntry[] = RUN_BONE_MAP,
    private readonly align = RUN_ALIGN,
    /** 몸이 위아래로 튀는 양을 잴 뼈 */
    rootName = 'pelvis',
  ) {
    this.alignInv = align.clone().invert();
    scene.updateMatrixWorld(true);
    const find = (name: string) => {
      let found: THREE.Object3D | null = null;
      scene.traverse((o) => {
        if (!found && norm(o.name) === norm(name)) found = o;
      });
      if (!found) throw new Error(`달리기 원본에 뼈 ${name}이 없습니다`);
      return found as THREE.Object3D;
    };
    for (const [s] of map) {
      const node = find(s);
      this.src.set(s, { node, restInv: node.getWorldQuaternion(new THREE.Quaternion()).invert() });
    }
    this.pelvis = find(rootName);
    this.pelvisRestY = this.pelvis.getWorldPosition(new THREE.Vector3()).y;
    this.mixer = new THREE.AnimationMixer(scene);
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.duration = clip.duration;
  }

  /**
   * phase(0~1) 시점의 동작을 계산한다.
   * out: 대상 뼈 이름 → 모델 좌표 기준 회전 차이 (대상 뼈의 기준 자세 모델 회전 앞에 곱한다)
   * 반환: 원본 높이 기준 뼈의 높이 변화 (원본 단위)
   */
  sample(phase: number, out: Map<string, THREE.Quaternion>): number {
    this.action.time = phase * this.duration;
    this.mixer.update(0);
    this.scene.updateMatrixWorld(true);
    for (const [s, t, k = 1] of this.map) {
      const e = this.src.get(s)!;
      const delta = e.node.getWorldQuaternion(this.q).multiply(e.restInv);
      if (k !== 1) delta.slerp(this.identity, 1 - k);
      let d = out.get(t);
      if (!d) {
        d = new THREE.Quaternion();
        out.set(t, d);
      }
      d.copy(this.align).multiply(delta).multiply(this.alignInv);
    }
    return this.pelvis.getWorldPosition(this.v).y - this.pelvisRestY;
  }
}
