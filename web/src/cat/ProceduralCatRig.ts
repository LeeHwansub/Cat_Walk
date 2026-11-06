import * as THREE from 'three';
import { createRng } from '../core/rng';
import { effectiveScale, girthScale, type CatAppearance } from './appearance';
import { solveTwoBone } from './ik';
import type { CatPose } from './pose';
import { HEAD_LAYER, type CatRig } from './rig';

// 성체 기준 치수 (m)
const UPPER = 0.11;
const LOWER = 0.105;
const HIP_STAND = 0.205;
const HIP_SIT = 0.075;
const HIP_LIE = 0.07;
const SPINE_SIT = -0.68;
const SPINE_STAND = -0.05; // 앞쪽을 살짝 들어 어깨와 엉덩이 높이를 맞춘다
const SPINE_LIE = -0.03;
const SHOULDER_Z = 0.27;
// 포즈 (지시서 2단계 7번)
/** 배 보이고 눕기(roll 1)일 때 몸통을 굴리는 각도. 완전히 뒤집지 않고 살짝 비스듬하게 */
const ROLL_MAX = 2.75;
/** 아저씨 앉기: 상체를 거의 세운다 */
const SPINE_MAN = -1.2;
const HIP_MAN = 0.062;
/** 기지개: 앞쪽을 낮추는 각도 */
const STRETCH_PITCH = 0.42;
/** 꼬리 감기: 꼬리가 바닥에서 몸을 감싸는 원의 중심(엉덩이 기준 z)과 시작 각도 */
const TAIL_WRAP_CENTER_Z = -0.02;
const TAIL_WRAP_START = 0.25;
const TAIL_BASE = new THREE.Vector3(0, 0.035, -0.075);
const BACK = new THREE.Vector3(0, 0, -1);
const STRIDE = 0.15;
const STANCE = 0.62; // 한 주기 중 발이 땅에 닿아 있는 비율
const TAIL_SEGMENTS = 9;
const TAIL_SEG_LEN = 0.04;

interface Leg {
  root: THREE.Group;
  knee: THREE.Group;
  front: boolean;
  side: 1 | -1;
  bend: 1 | -1;
  phaseOffset: number;
}

const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const lerp = THREE.MathUtils.lerp;

/** 코드로 만든 반사실적 로우폴리 고양이 (D-14 대체 경로) */
export class ProceduralCatRig implements CatRig {
  readonly root = new THREE.Group();
  readonly eyeAnchor = new THREE.Object3D();
  /** 다리 길이 배율 (아기는 다리가 짧다) */
  private legScale = 1;
  private eyeScale = 1;
  /** 체형: 몸통 둘레 배율 (날씬 0.8 ↔ 통통 1.3) */
  private girth = 1;
  /** 체형 슬라이더 값에 따른 둘레 (풍선으로 부풀기 전) */
  private baseGirth = 1;
  /** 체형에 따라 둘레가 바뀌는 부위: 메시, 기준 크기, 늘릴 축 */
  private readonly girthParts: { mesh: THREE.Object3D; base: THREE.Vector3; axes: 'xy' | 'xz' | 'xyz'; power: number; belly?: { baseY: number } }[] = [];
  private readonly legBaseX = new Map<THREE.Group, number>();

  get cycleLength(): number {
    return (STRIDE * this.legScale) / STANCE;
  }

  private readonly hips = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly chest = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly headScaler = new THREE.Group();
  private readonly tail: THREE.Group[] = [];
  private readonly legs: Leg[] = [];
  private readonly eyes: THREE.Group[] = [];
  private readonly ears: THREE.Mesh[] = [];
  private readonly earTwitchAmt = [0, 0];
  private earBaseX = 0;
  /** 이마 M자 무늬 (줄무늬 고양이) */
  private mMark!: THREE.Mesh;
  private readonly mMarkMat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
  /** 꼬리 끝 (줄무늬 고양이는 진하게) */
  private tailTip!: THREE.Mesh;
  private readonly tailTipMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  /** 목걸이 + 하트 태그 */
  private readonly collar = new THREE.Group();

  private readonly furMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  private readonly lightMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  private readonly pawMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  private readonly irisMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0, emissiveIntensity: 0.15 });

  private nextBlink = 2;
  private blinkUntil = 0;
  private earTwitch = { at: 3, side: 0, until: 0 };
  private lastTime = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly wrapDirs = Array.from({ length: TAIL_SEGMENTS }, () => new THREE.Vector3());
  private readonly qa = new THREE.Quaternion();
  private readonly qb = new THREE.Quaternion();
  private readonly qc = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();

  constructor(appearance: CatAppearance) {
    this.build();
    this.setAppearance(appearance);
  }

  setAppearance(a: CatAppearance): void {
    const fur = new THREE.Color(a.furColor);
    const light = fur.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    const white = new THREE.Color('#f3efe8');
    this.furMat.map?.dispose();
    this.furMat.map = null;
    this.furMat.color.set('#ffffff');
    switch (a.pattern) {
      case 'solid':
        this.furMat.color.copy(fur);
        this.lightMat.color.copy(fur);
        this.pawMat.color.copy(fur);
        break;
      case 'tuxedo':
        this.furMat.color.copy(fur);
        this.lightMat.color.copy(white);
        this.pawMat.color.copy(white);
        break;
      case 'cheese':
      case 'mackerel':
        this.furMat.map = tabbyTexture(fur, a.pattern === 'mackerel' ? 0.45 : 0.68);
        this.lightMat.color.copy(light);
        this.pawMat.color.copy(light);
        break;
      case 'tabbyWhite':
        // 고등어 줄무늬 + 흰 가슴·흰 양말 (뽀리)
        this.furMat.map = tabbyTexture(fur, 0.5);
        this.lightMat.color.copy(white);
        this.pawMat.color.copy(white);
        break;
      case 'calico':
        this.furMat.map = calicoTexture(fur);
        this.lightMat.color.copy(white);
        this.pawMat.color.copy(white);
        break;
    }
    this.furMat.needsUpdate = true;

    // 줄무늬 고양이: 이마 M자 무늬와 진한 꼬리 끝
    const tabby = a.pattern === 'cheese' || a.pattern === 'mackerel' || a.pattern === 'tabbyWhite';
    const stripe = fur.clone().multiplyScalar(a.pattern === 'cheese' ? 0.62 : 0.42);
    this.mMark.visible = tabby;
    this.mMarkMat.map?.dispose();
    this.mMarkMat.map = tabby ? mMarkTexture(stripe) : null;
    this.mMarkMat.needsUpdate = true;
    this.tailTip.material = tabby ? this.tailTipMat : this.furMat;
    this.tailTipMat.color.copy(fur.clone().multiplyScalar(a.pattern === 'cheese' ? 0.7 : 0.38));

    this.irisMat.color.set(a.eyeColor);
    this.irisMat.emissive.set(a.eyeColor);

    // 아기 비율: 머리·눈은 몸에 비해 크고, 다리·꼬리는 짧다 (지시서 2단계 성장 단계)
    const kitten = a.stage === 'kitten';
    // 스코티시폴드(접힌 귀) 실루엣: 더 둥글고 넓은 머리, 조금 큰 눈, 조금 짧은 다리
    const fold = a.ear === 'fold';
    this.root.scale.setScalar(effectiveScale(a.stage, a.size));
    const head = kitten ? 1.22 : 1;
    this.headScaler.scale.set(head * (fold ? 1.07 : 1), head * (fold ? 0.97 : 1), head);
    this.eyeScale = kitten ? 1.18 : 1;
    this.legScale = (kitten ? 0.84 : 1) * (fold ? 0.93 : 1);
    this.setEars(fold);
    this.collar.visible = a.accessory === 'heartTag';
    for (const leg of this.legs) leg.root.scale.setScalar(this.legScale);
    this.tail[0].scale.setScalar(kitten ? 0.8 : 1);
    this.baseGirth = girthScale(a.build);
    this.applyGirth(this.baseGirth);
  }

  apply(p: CatPose, time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;

    // 몸통: 서기 → 앉기 → 엎드리기 혼합
    const settle = Math.max(p.sit, p.lie);
    const bob = Math.sin(p.gaitPhase * Math.PI * 4) * 0.006 * p.speed;
    const breathe = Math.sin(time * (p.lie > 0.5 ? 1.4 : 2.4)) * (p.lie > 0.5 ? 0.02 : 0.012);
    // 통통하면 몸통 반지름이 커지므로 앉기·엎드리기 높이도 같이 올려 몸이 땅에 묻히지 않게 한다
    const rollA = p.roll * ROLL_MAX;
    // 옆으로 누우면 아래쪽 다리가 땅에 묻히지 않게, 식빵은 접은 앞발 위에 올라앉게 조금 높인다
    const lieY = HIP_LIE * this.girth + 0.012 * Math.sin(Math.min(rollA, Math.PI / 2)) + 0.01 * p.tuck;
    let hipY = lerp(lerp(HIP_STAND * this.legScale, HIP_SIT * this.girth, p.sit), lieY, p.lie) + bob * (1 - settle);
    hipY = lerp(hipY, HIP_MAN * this.girth, p.manSit);
    // 고개를 깊이 숙이면(먹기·냄새 맡기) 앞쪽을 낮춰 앞다리를 굽힌다
    const crouch = Math.max(0, p.headPitch - 0.6) * 0.5 * (1 - settle);
    let spinePitch = lerp(lerp(SPINE_STAND, SPINE_SIT, p.sit), SPINE_LIE, p.lie) + crouch + Math.sin(p.gaitPhase * Math.PI * 4 + 1) * 0.015 * p.speed;
    spinePitch = lerp(spinePitch, SPINE_MAN, p.manSit) + STRETCH_PITCH * p.stretch;
    this.hips.position.set(0, hipY, -0.13);
    this.spine.rotation.set(spinePitch, 0, Math.sin(p.gaitPhase * Math.PI * 2) * 0.03 * p.speed);
    this.chest.scale.set(1 + breathe, 1 + breathe, 1);

    // 목과 머리: 머리는 몸이 흔들려도 수평을 유지한다 (고양이 특유의 안정된 머리)
    // 머리를 숙일 때는 목도 함께 내려 입이 바닥(그릇, 풀)에 닿게 한다
    // 아저씨 앉기는 상체가 서 있는 만큼 목을 앞으로, 기지개는 고개를 들어 앞을 본다
    const neckPitch = lerp(-0.75, -0.2, p.lie) + p.sit * 0.25 + Math.max(0, p.headPitch - 0.2) * 0.9 + 0.45 * p.manSit - 0.35 * p.stretch;
    this.neck.rotation.x = neckPitch;
    // 몸을 굴리면 머리는 일부만 따라 돌린다 (바닥에 뺨을 대거나 고개를 꺾은 모양)
    this.head.rotation.set(p.headPitch - spinePitch - neckPitch, p.headYaw, p.headTilt - rollA * 0.35, 'YXZ');
    this.head.position.y = 0.075 + Math.sin(time * 18) * 0.004 * p.lick;

    // 풍선: 몸통이 더 동그랗게 부푼다 (체형 둘레에 곱함)
    const inflated = this.baseGirth * (1 + 0.28 * p.float);
    if (Math.abs(inflated - this.girth) > 1e-3) this.applyGirth(inflated);
    // 옆으로 눕기·배 보이고 눕기: 몸통 전체를 길이 축으로 굴린다
    // 풍선: 둥실거리며 살짝 기울어진다
    const swayZ = p.float > 0.01 ? Math.sin(time * 0.9) * 0.06 * p.float : 0;
    const swayX = p.float > 0.01 ? Math.sin(time * 0.7 + 1) * 0.04 * p.float : 0;
    this.hips.rotation.set(swayX, 0, rollA + swayZ);

    this.updateEyes(p, time);
    this.updateEars(time, dt);
    this.updateTail(p, time, hipY);

    // 다리 IK: 몸통 자세가 정해진 뒤 어깨/엉덩이 위치를 계산해서 발을 지면에 딛게 한다
    this.root.updateMatrixWorld(true);
    for (const leg of this.legs) this.solveLeg(leg, p, spinePitch);
  }

  /** 분홍 목걸이 + 하트 태그 (뽀리). 목 굵기를 따라 커진다 */
  private buildCollar(): void {
    const band = new THREE.MeshStandardMaterial({ color: '#e0607e', roughness: 0.55 });
    const tagMat = new THREE.MeshStandardMaterial({ color: '#f39ab4', roughness: 0.3, metalness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0065, 8, 28), band);
    ring.rotation.x = Math.PI / 2;
    this.collar.add(ring);
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.5);
    heart.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.5, 0.25);
    heart.bezierCurveTo(-0.45, 0.55, -0.1, 0.55, 0, 0.3);
    heart.bezierCurveTo(0.1, 0.55, 0.45, 0.55, 0.5, 0.25);
    heart.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.5);
    const tag = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), tagMat);
    // 태그는 고리 앞쪽에서 아래로 늘어진다
    tag.scale.setScalar(0.022);
    tag.position.set(0, -0.016, 0.054);
    this.collar.add(tag);
    // 목은 앞으로 약 0.75rad 기울어 있다. 고리도 같이 기울면 앞쪽이 들려 주둥이와 겹치므로,
    // 반대로 돌려 서 있을 때 수평이 되게 하고 목 아래쪽(가슴과 만나는 곳)에 둔다
    this.collar.rotation.x = 0.8;
    this.collar.position.set(0, -0.004, -0.012);
    this.collar.traverse((o) => {
      o.castShadow = true;
      o.layers.set(HEAD_LAYER); // 캣캠 화면을 가리지 않게
    });
    this.neck.add(this.collar);
    this.girthPart(this.collar, 'xz', 0.7);
  }

  private girthPart(mesh: THREE.Object3D, axes: 'xy' | 'xz' | 'xyz', power: number, belly = false): void {
    this.girthParts.push({ mesh, base: mesh.scale.clone(), axes, power, belly: belly ? { baseY: mesh.position.y } : undefined });
  }

  /** 체형 적용: 몸통·배·목·허벅지·볼의 둘레만 바꾸고 길이는 그대로 둔다 */
  private applyGirth(g: number): void {
    this.girth = g;
    for (const p of this.girthParts) {
      const k = Math.pow(g, p.power);
      p.mesh.scale.set(p.base.x * k, p.axes === 'xz' ? p.base.y : p.base.y * k, p.axes === 'xy' ? p.base.z : p.base.z * k);
      if (p.axes === 'xyz') p.mesh.scale.set(p.base.x * k, p.base.y * k, p.base.z * k);
      if (p.belly) p.mesh.position.y = p.belly.baseY - (g - 1) * 0.03;
    }
    // 몸이 넓어진 만큼 다리 붙는 자리도 바깥으로
    for (const [root, x] of this.legBaseX) root.position.x = x * Math.pow(g, 0.7);
  }

  twitchEar(): void {
    const t = this.lastTime;
    this.earTwitch = { at: t + 3 + Math.random() * 4, side: Math.random() < 0.5 ? 0 : 1, until: t + 0.25 };
  }

  // ---------------------------------------------------------------- 구성

  private build(): void {
    const sphere = (r: number, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], scale?: [number, number, number], rotX = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      if (scale) m.scale.set(...scale);
      m.rotation.x = rotX;
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    this.root.add(this.hips);
    this.hips.add(this.spine);

    // 몸통 (줄무늬가 몸을 감싸도록 축을 z 방향으로 눕힌다)
    this.girthPart(add(this.hips, sphere(0.078), this.furMat, [0, 0.012, 0], [0.95, 0.95, 1.1]), 'xy', 1);
    // 옆으로 눕힌 캡슐: 로컬 y가 길이, x·z가 둘레
    this.girthPart(add(this.spine, new THREE.CapsuleGeometry(0.07, 0.2, 8, 18), this.furMat, [0, 0.008, 0.13], [0.93, 1, 1], Math.PI / 2), 'xz', 1);
    this.chest.position.set(0, 0.008, 0.25);
    this.spine.add(this.chest);
    this.girthPart(add(this.chest, sphere(0.08), this.furMat, [0, 0, 0], [0.92, 1, 1]), 'xy', 1);
    // 앞가슴 털: 캣캠에서는 앞발을 가리므로 머리와 같은 레이어에 둔다
    const chestFur = add(this.chest, sphere(0.058), this.lightMat, [0, -0.028, 0.035], [1, 1.05, 0.9]);
    chestFur.layers.set(HEAD_LAYER);
    this.girthPart(chestFur, 'xy', 1);
    const belly = add(this.spine, sphere(0.06), this.lightMat, [0, -0.04, 0.13], [0.9, 0.7, 1.9]); // 배
    this.girthPart(belly, 'xy', 1.4, true); // 통통하면 배가 더 처진다

    // 목·머리
    this.neck.position.set(0, 0.045, 0.3);
    this.spine.add(this.neck);
    const neckMesh = add(this.neck, new THREE.CapsuleGeometry(0.045, 0.05, 6, 12), this.furMat, [0, 0.035, 0]);
    this.girthPart(neckMesh, 'xz', 0.7);
    this.buildCollar();
    neckMesh.layers.set(HEAD_LAYER);
    // 캣캠: 어깨 위에서 가슴 쪽을 내려다보는 위치. 참조 영상처럼 지면, 가슴 털, 앞발이 보인다.
    // (몸통 안쪽 면은 뒷면 컬링으로 그려지지 않는다)
    this.eyeAnchor.position.set(0, 0.06, 0.3);
    this.spine.add(this.eyeAnchor);
    this.head.position.set(0, 0.075, 0.015);
    this.neck.add(this.head);
    this.head.add(this.headScaler);
    this.buildHead(add, sphere);

    // 다리: 앞다리는 팔꿈치가 뒤로(-1), 뒷다리는 무릎이 앞으로(+1)
    const legDefs: [boolean, 1 | -1, number][] = [
      [false, 1, 0], // 왼쪽 뒷다리
      [true, 1, 0.25], // 왼쪽 앞다리
      [false, -1, 0.5], // 오른쪽 뒷다리
      [true, -1, 0.75], // 오른쪽 앞다리
    ];
    for (const [front, side, phaseOffset] of legDefs) {
      const root = new THREE.Group();
      const knee = new THREE.Group();
      if (front) {
        root.position.set(0.042 * side, -0.01, SHOULDER_Z);
        this.spine.add(root);
      } else {
        root.position.set(0.048 * side, -0.005, 0);
        this.hips.add(root);
      }
      const upperR = front ? 0.024 : 0.032;
      const lowerR = front ? 0.019 : 0.018;
      this.girthPart(add(root, new THREE.CapsuleGeometry(upperR, UPPER - upperR, 4, 10), this.furMat, [0, -UPPER / 2, 0]), 'xz', 0.6);
      this.legBaseX.set(root, root.position.x);
      knee.position.y = -UPPER;
      root.add(knee);
      add(knee, new THREE.CapsuleGeometry(lowerR, LOWER - lowerR, 4, 10), front ? this.pawMat : this.furMat, [0, -LOWER / 2, 0]);
      add(knee, sphere(0.024, 12, 8), this.pawMat, [0, -LOWER + 0.006, 0.012], [1, 0.62, 1.3]);
      this.legs.push({ root, knee, front, side, bend: front ? -1 : 1, phaseOffset });
    }

    // 꼬리: 마디를 사슬로 이어 2차 움직임(물결)을 만든다
    let parent: THREE.Object3D = this.hips;
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.035 : 0, i === 0 ? -0.075 : -TAIL_SEG_LEN);
      parent.add(seg);
      const r = lerp(0.021, 0.013, i / (TAIL_SEGMENTS - 1));
      const m = add(seg, new THREE.CapsuleGeometry(r, TAIL_SEG_LEN * 0.9, 4, 10), this.furMat, [0, 0, -TAIL_SEG_LEN / 2], undefined, Math.PI / 2);
      if (i === TAIL_SEGMENTS - 1) this.tailTip = m;
      this.tail.push(seg);
      parent = seg;
    }
  }

  private buildHead(
    add: (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], s?: [number, number, number], rx?: number) => THREE.Mesh,
    sphere: (r: number, w?: number, h?: number) => THREE.SphereGeometry,
  ): void {
    const h = this.headScaler;
    const pink = new THREE.MeshStandardMaterial({ color: '#d98c8c', roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.3 });

    add(h, sphere(0.066, 24, 18), this.furMat, [0, 0, 0], [1, 0.88, 0.95]);
    this.girthPart(add(h, sphere(0.042), this.furMat, [0.03, -0.022, 0.028], [1, 0.8, 0.9]), 'xyz', 0.5); // 볼
    this.girthPart(add(h, sphere(0.042), this.furMat, [-0.03, -0.022, 0.028], [1, 0.8, 0.9]), 'xyz', 0.5);
    add(h, sphere(0.03), this.lightMat, [0, -0.03, 0.056], [1.3, 0.75, 0.85]); // 주둥이
    add(h, sphere(0.009, 10, 8), pink, [0, -0.014, 0.083], [1.4, 0.8, 0.6]); // 코

    // 이마 M자 무늬: 이마 곡면에 얇은 판을 붙인다
    this.mMark = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.034), this.mMarkMat);
    this.mMark.position.set(0, 0.033, 0.052);
    this.mMark.rotation.x = -0.6;
    h.add(this.mMark);

    for (const side of [1, -1]) {
      const ear = add(h, new THREE.ConeGeometry(0.032, 0.062, 4, 1), this.furMat, [0.036 * side, 0.054, -0.004], [1, 1, 0.45]);
      ear.rotation.set(0, (Math.PI / 4) * side, -0.28 * side);
      const inner = add(ear, new THREE.ConeGeometry(0.022, 0.045, 4, 1), pink, [0, -0.006, 0.006], [1, 1, 0.5]);
      inner.castShadow = false;
      this.ears.push(ear);

      const eye = new THREE.Group();
      eye.position.set(0.026 * side, 0.006, 0.054);
      eye.rotation.y = 0.32 * side;
      h.add(eye);
      add(eye, sphere(0.0145, 16, 12), this.irisMat, [0, 0, 0]);
      add(eye, sphere(0.0146, 12, 10), dark, [0, 0, 0.0035], [0.28, 0.92, 0.6]); // 세로 동공
      this.eyes.push(eye);
    }

    // 수염
    const pts: number[] = [];
    for (const side of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        pts.push(0.024 * side, -0.03 - i * 0.004, 0.068, 0.1 * side, -0.026 - i * 0.014, 0.075 - i * 0.008);
      }
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    h.add(new THREE.LineSegments(wGeo, new THREE.LineBasicMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.8 })));

    h.traverse((o) => o.layers.set(HEAD_LAYER));
  }

  // ---------------------------------------------------------------- 애니메이션

  private solveLeg(leg: Leg, p: CatPose, spinePitch: number): void {
    // 어깨/엉덩이 위치 (루트 공간)
    leg.root.getWorldPosition(this.tmp);
    this.root.worldToLocal(this.tmp);
    const sy = this.tmp.y;
    const sz = this.tmp.z;

    // 서 있을 때 발 기준 위치
    const standZ = leg.front ? SHOULDER_Z - 0.13 + 0.035 : -0.13 - 0.01;
    let fz = standZ;
    let fy = 0;

    // 걷기 주기
    if (p.speed > 0.01) {
      const c = (((p.gaitPhase + leg.phaseOffset) % 1) + 1) % 1;
      if (c < STANCE) {
        fz += lerp(STRIDE / 2, -STRIDE / 2, c / STANCE) * p.speed * this.legScale;
      } else {
        const s = (c - STANCE) / (1 - STANCE);
        fz += lerp(-STRIDE / 2, STRIDE / 2, s) * p.speed * this.legScale;
        fy += Math.sin(s * Math.PI) * 0.045 * p.speed;
      }
    }

    // 앉기: 뒷발은 엉덩이 앞으로 접고, 앞발은 가슴 아래로
    const sitZ = leg.front ? sz + 0.015 : -0.13 + 0.075;
    // 엎드리기: 앞발은 가슴 앞으로 접어 넣고 뒷발은 배 아래로
    const lieZ = leg.front ? sz + 0.05 : -0.13 + 0.06;
    const lieY = leg.front ? 0.012 : 0.02;
    fz = lerp(lerp(fz, sitZ, p.sit), lieZ, p.lie);
    fy = lerp(fy, lieY, p.lie);

    if (leg.front) {
      // 식빵: 앞발을 가슴 아래로 접어 넣는다
      const tk = p.tuck * p.lie;
      fz = lerp(fz, sz - 0.035, tk);
      fy = lerp(fy, 0.035, tk);
      // 기지개: 앞다리를 앞으로 쭉 뻗는다
      fz = lerp(fz, sz + 0.19, p.stretch);
      fy = lerp(fy, 0, p.stretch);
    } else {
      fz = lerp(fz, standZ - 0.03, p.stretch);
      // 아저씨 앉기: 뒷다리를 앞으로 뻗는다
      fz = lerp(fz, -0.13 + 0.17, p.manSit);
      fy = lerp(fy, 0.012, p.manSit);
    }

    // 풍선: 발을 닿지 않는 아래쪽으로 두어 다리를 곧게 늘어뜨리고, 천천히 허우적거린다
    if (p.float > 0.001) {
      const paddle = Math.sin(this.lastTime * 2.2 + leg.phaseOffset * Math.PI * 2) * 0.03;
      fy = lerp(fy, sy - 0.4, p.float);
      fz = lerp(fz, sz + paddle, p.float);
    }

    // 그루밍: 오른쪽 앞발을 입이나 얼굴로 가져간다
    if (leg.front && leg.side === -1 && p.pawLift > 0.001) {
      this.headScaler.getWorldPosition(this.tmp);
      this.root.worldToLocal(this.tmp);
      const hy = this.tmp.y; // worldToLocal이 루트 스케일까지 되돌리므로 성체 기준 단위
      const hz = this.tmp.z;
      const toFace = p.pawToFace;
      const wipe = Math.sin(this.lastTime * 7) * 0.02 * toFace;
      const gy = lerp(hy - 0.065, hy - 0.022 + wipe, toFace);
      const gz = lerp(hz + 0.035, hz + 0.055, toFace);
      fy = lerp(fy, gy, p.pawLift);
      fz = lerp(fz, gz, p.pawLift);
    }

    const ls = this.legScale;
    const ik = solveTwoBone(UPPER * ls, LOWER * ls, fz - sz, fy - sy, leg.bend);
    const parentPitch = leg.front ? spinePitch : 0;
    let upper = -ik.upper - parentPitch;
    let lower = -ik.lower;

    // 몸을 굴렸거나(옆·배) 상체를 세웠을 때(아저씨 앉기 앞발)는 발이 땅을 딛지 않는다.
    // 이때는 몸 기준 방향으로 다리 자세를 정한다
    const rollW = Math.min(1, p.roll * 2);
    const manW = leg.front ? p.manSit : 0;
    const w = Math.max(rollW, manW);
    if (w > 0.001) {
      let bz: number;
      let by: number;
      if (manW >= rollW) {
        // 앞발을 배 앞에 축 늘어뜨린다
        bz = -0.07;
        by = -0.075;
      } else {
        // 옆으로 누우면 다리를 몸 바깥으로 쭉 뻗고, 뒤집으면 앞발을 가슴 쪽으로 오므린다
        const belly = Math.max(0, p.roll * 2 - 1);
        bz = lerp(leg.front ? 0.07 : -0.05, leg.front ? 0.035 : 0.04, belly);
        by = lerp(-0.185, leg.front ? -0.085 : -0.11, belly);
      }
      const rk = solveTwoBone(UPPER * ls, LOWER * ls, bz * ls, by * ls, leg.bend);
      upper = lerp(upper, -rk.upper, w);
      lower = lerp(lower, -rk.lower, w);
    }
    leg.root.rotation.x = upper;
    leg.knee.rotation.x = lower;
  }

  private updateEyes(p: CatPose, time: number): void {
    if (time > this.nextBlink) {
      this.blinkUntil = time + 0.13;
      this.nextBlink = time + 2.5 + Math.random() * 4;
    }
    const blink = time < this.blinkUntil ? 1 : 0;
    const closed = Math.max(p.eyesClosed, blink);
    for (const e of this.eyes) e.scale.set(this.eyeScale, this.eyeScale * lerp(1, 0.08, closed), this.eyeScale);
  }

  /** 귀 형태: 선 귀 / 접힌 귀(앞으로 접혀 머리에 붙음) */
  private setEars(fold: boolean): void {
    this.ears.forEach((ear, i) => {
      const side = i === 0 ? 1 : -1;
      if (fold) {
        ear.position.set(0.034 * side, 0.047, 0.008);
        ear.rotation.set(1.05, (Math.PI / 5) * side, -0.45 * side);
        ear.scale.set(1.05, 0.6, 0.45);
      } else {
        ear.position.set(0.036 * side, 0.054, -0.004);
        ear.rotation.set(0, (Math.PI / 4) * side, -0.28 * side);
        ear.scale.set(1, 1, 0.45);
      }
    });
    this.earBaseX = fold ? 1.05 : 0;
  }

  private updateEars(time: number, dt: number): void {
    if (time > this.earTwitch.at) {
      this.earTwitch = { at: time + 3 + Math.random() * 6, side: Math.random() < 0.5 ? 0 : 1, until: time + 0.25 };
    }
    this.ears.forEach((ear, i) => {
      // 귀 움찔: 기본 각도에서 잠깐 뒤로 젖혔다 돌아온다 (접힌 귀는 작게)
      const amp = this.earBaseX > 0 ? -0.25 : -0.5;
      const target = time < this.earTwitch.until && i === this.earTwitch.side ? amp : 0;
      this.earTwitchAmt[i] += (target - this.earTwitchAmt[i]) * damp(20, dt);
      ear.rotation.x = this.earBaseX + this.earTwitchAmt[i];
    });
  }

  private updateTail(p: CatPose, time: number, hipY: number): void {
    const n = this.tail.length;
    if (p.tailWrap > 0.001) this.computeWrapDirs(hipY);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // 세운 꼬리: 위로 솟았다가 끝이 살짝 앞으로 말린 물음표 모양
      const upCurve = i === 0 ? 1.25 : t > 0.7 ? 0.28 : -0.1;
      // 내린 꼬리: 아래로 늘어졌다가 바닥을 따라 몸 옆으로 감김
      const downCurve = i === 0 ? -0.95 : i === 1 ? 0.55 : 0.05;
      const curlSide = i === 0 ? 0 : (p.sit + p.lie) * 0.22;
      const wave = Math.sin(time * (2.2 + p.tailWag * 2) - i * 0.55) * p.tailWag * (0.08 + t * 0.2);
      this.tail[i].rotation.set(lerp(downCurve, upCurve, p.tailUp), curlSide + wave, 0);
      if (p.tailWrap > 0.001) {
        // 꼬리 감기 경로를 따르는 회전 (부모 마디 방향 기준)으로 섞는다
        this.qa.setFromUnitVectors(BACK, this.wrapDirs[i]);
        if (i > 0) this.qa.premultiply(this.qb.setFromUnitVectors(BACK, this.wrapDirs[i - 1]).invert());
        this.qc.setFromEuler(this.euler.set(0, wave * 0.6, 0));
        this.qa.multiply(this.qc);
        this.tail[i].quaternion.slerp(this.qa, p.tailWrap);
      }
    }
  }

  /**
   * 꼬리 감기 경로: 꼬리 뿌리에서 엉덩이 뒤 바닥으로 내려간 뒤, 몸을 중심으로 한 원을 따라
   * 몸 옆으로 돌아 앞쪽을 향한다. 각 마디가 향할 방향(엉덩이 기준)을 구한다.
   * 마디별 각도를 직접 정하면 기울어진 마디에서 옆으로 꺾을 때 꼬리가 들리므로 경로로 계산한다.
   */
  private computeWrapDirs(hipY: number): void {
    const segLen = TAIL_SEG_LEN * this.tail[0].scale.x;
    const groundY = -hipY + 0.016; // 꼬리 굵기만큼 띄운다
    const r = 0.085 * this.girth + 0.022; // 몸 옆을 지나도록 체형에 맞춘 반지름
    const start = new THREE.Vector3(r * Math.sin(TAIL_WRAP_START), groundY, TAIL_WRAP_CENTER_Z - r * Math.cos(TAIL_WRAP_START));
    const base = TAIL_BASE.clone();
    const drop = base.distanceTo(start);
    const at = (d: number, out: THREE.Vector3) => {
      if (d <= drop) return out.lerpVectors(base, start, d / drop);
      const a = TAIL_WRAP_START + (d - drop) / r;
      return out.set(r * Math.sin(a), groundY, TAIL_WRAP_CENTER_Z - r * Math.cos(a));
    };
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    for (let i = 0; i < this.wrapDirs.length; i++) {
      at(i * segLen, p0);
      at((i + 1) * segLen, p1);
      this.wrapDirs[i].subVectors(p1, p0).normalize();
    }
  }
}

// ---------------------------------------------------------------- 무늬 텍스처

function canvas(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 줄무늬(치즈·고등어): 바탕색에 더 어두운 물결 줄무늬 */
function tabbyTexture(fur: THREE.Color, darkness: number): THREE.CanvasTexture {
  const rng = createRng(21);
  const dark = fur.clone().multiplyScalar(darkness);
  return canvas((g) => {
    g.fillStyle = `#${fur.getHexString()}`;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = `#${dark.getHexString()}`;
    g.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      const y0 = (i + 0.5) * (256 / 11);
      g.lineWidth = 5 + rng() * 6;
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) {
        const y = y0 + Math.sin(x / 30 + i) * 5 + (rng() - 0.5) * 3;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

/** 이마 M자 무늬: 투명 바탕에 진한 줄 세 개 + M자 윗선 */
function mMarkTexture(color: THREE.Color): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 88;
  const g = c.getContext('2d')!;
  g.strokeStyle = `#${color.getHexString()}`;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(18, 70);
  g.lineTo(34, 20);
  g.lineTo(64, 52);
  g.lineTo(94, 20);
  g.lineTo(110, 70);
  g.stroke();
  g.lineWidth = 7;
  for (const x of [52, 64, 76]) {
    g.beginPath();
    g.moveTo(x, 8);
    g.lineTo(x + (x - 64) * 0.15, 40);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 삼색: 흰 바탕에 주황·검정 얼룩 */
function calicoTexture(fur: THREE.Color): THREE.CanvasTexture {
  const rng = createRng(33);
  return canvas((g) => {
    g.fillStyle = '#f3efe8';
    g.fillRect(0, 0, 256, 256);
    const colors = [`#${fur.getHexString()}`, '#2b2a2c'];
    for (let i = 0; i < 14; i++) {
      g.fillStyle = colors[i % 2];
      g.beginPath();
      const cx = rng() * 256;
      const cy = rng() * 256;
      const r = 18 + rng() * 34;
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
        const rr = r * (0.7 + rng() * 0.5);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.fill();
    }
  });
}
