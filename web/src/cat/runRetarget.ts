import * as THREE from 'three';

/**
 * 달리기 동작 원본: `_box/blender/motion/Run.blend`의 뼈대와 동작만 내보낸 `cat-run.glb`.
 * 고양이 모델(캐릭터.glb)과 뼈대가 달라(뼈 27개, 이름·마디 수 다름) 뼈를 짝지어 옮긴다.
 * [원본 뼈, 대상 뼈] — 앞다리 4번째(발가락)와 꼬리 끝은 짝이 없어 대상 쪽은 부모를 따라간다.
 */
export const RUN_BONE_MAP: [string, string][] = [
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
  /** 원본 골반 기준 높이 (원본 단위 m) */
  readonly pelvisRestY: number;
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly alignInv: THREE.Quaternion;

  constructor(
    private readonly scene: THREE.Object3D,
    clip: THREE.AnimationClip,
    private readonly map: [string, string][] = RUN_BONE_MAP,
    private readonly align = RUN_ALIGN,
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
    this.pelvis = find('pelvis');
    this.pelvisRestY = this.pelvis.getWorldPosition(new THREE.Vector3()).y;
    this.mixer = new THREE.AnimationMixer(scene);
    this.action = this.mixer.clipAction(clip);
    this.action.play();
    this.duration = clip.duration;
  }

  /**
   * phase(0~1) 시점의 동작을 계산한다.
   * out: 대상 뼈 이름 → 모델 좌표 기준 회전 차이 (대상 뼈의 기준 자세 모델 회전 앞에 곱한다)
   * 반환: 원본 골반 높이 변화 (원본 단위 m)
   */
  sample(phase: number, out: Map<string, THREE.Quaternion>): number {
    this.action.time = phase * this.duration;
    this.mixer.update(0);
    this.scene.updateMatrixWorld(true);
    for (const [s, t] of this.map) {
      const e = this.src.get(s)!;
      const delta = e.node.getWorldQuaternion(this.q).multiply(e.restInv);
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
