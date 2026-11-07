import * as THREE from 'three';
import { effectiveScale, girthScale, type CatAppearance } from './appearance';
import { applyAppearanceToUniforms, createCatSkinMaterial, createCatSkinUniforms, inflateFor, type CatSkinUniforms } from './catSkin';
import { furLength, shellCount, type ResolvedFurQuality } from './fur';
import { MAX_SHELLS } from './furShells';
import { setWorldQuaternion, solveTwoBoneIK } from './ik3d';
import type { CatPose } from './pose';
import { HEAD_LAYER, type CatRig } from './rig';

/**
 * 뼈대가 있는 glb 고양이 모델 (사용자 제공 캐릭터.glb = Sketchfab "Toon Cat FREE", CC BY 4.0).
 * 모든 고양이 캐릭터의 기준 모델이다 (2026-11-06 사용자 결정, D-31).
 * 행동·자세 시스템(CatPose)은 그대로 쓰고, 뼈를 코드로 움직인다. 파일 안의 달리기 동작은 쓰지 않는다.
 *
 * 좌표: 모델 단위(정점·뼈 위치)는 y 위, z 앞. MODEL_SCALE을 곱하면 성체 기준 m가 된다.
 */
export const MODEL_SCALE = 0.12;

const STRIDE = 0.11;
const STANCE = 0.62;
const SPINE_SIT = -0.45;
const SPINE_LIE = -0.03;
const SPINE_STAND = 0;
const SPINE_MAN = -1.15;
const STRETCH_PITCH = 0.38;
const ROLL_MAX = 2.75;
const FOOT_LIFT = 0.035;
/** 이 모델의 다리 길이 / 도형 모델 다리 길이 (포즈 목표 위치를 맞추는 비율) */
const LEG_K = 0.65;

/** glb 뼈 이름 (GLTFLoader가 '.'을 지우므로 비교할 때는 영문·숫자만 본다) */
const BONES = {
  torso: 'torso_02',
  spine1: 'spine.01_012',
  spine2: 'spine.02_013',
  neck: 'neck_017',
  head: 'head_018',
  ears: ['ear.L_019', 'ear.R_020'],
  mouth: 'mouth_021',
  eyes: ['eye.L_022', 'eye.R_023'],
  tail: ['tail_07', 'tail.01_08', 'tail.02_09', 'tail.03_010', 'tail.end_011'],
};

interface LegDef {
  front: boolean;
  side: 1 | -1;
  phaseOffset: number;
  names: string[];
}

const LEG_DEFS: LegDef[] = [
  { front: false, side: 1, phaseOffset: 0, names: ['thigh.B.L_03', 'leg.upper.B.L_04', 'leg.lower.B.L_05', 'foot.B.L_06'] },
  { front: true, side: 1, phaseOffset: 0.25, names: ['leg.upper.F.L_014', 'leg.lower.FL_015', 'foot.F.L_016'] },
  { front: false, side: -1, phaseOffset: 0.5, names: ['thigh.B.R_026', 'leg.upper.B.R_027', 'leg.lower.B.R_028', 'foot.B.R_029'] },
  { front: true, side: -1, phaseOffset: 0.75, names: ['leg.upper.F.R_024', 'leg.lower.F.R_00', 'foot.F.R_025'] },
];

interface Rest {
  q: THREE.Quaternion;
  pos: THREE.Vector3;
  scale: THREE.Vector3;
  /** 모델 공간(루트 기준) 회전 */
  modelQ: THREE.Quaternion;
  /** 루트 기준 위치 (성체 m) */
  rootPos: THREE.Vector3;
}

interface Leg extends LegDef {
  bones: THREE.Bone[];
  /** 서 있을 때 발 위치 (루트 기준 m) */
  standZ: number;
  pawY: number;
}

const lerp = THREE.MathUtils.lerp;
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');

export class SkinnedCatRig implements CatRig {
  readonly root = new THREE.Group();
  readonly eyeAnchor = new THREE.Object3D();

  private readonly model = new THREE.Group();
  private readonly mesh: THREE.SkinnedMesh;
  private readonly bones: THREE.Bone[];
  private readonly rest = new Map<THREE.Bone, Rest>();
  private readonly uniforms: CatSkinUniforms = createCatSkinUniforms();

  private readonly torso: THREE.Bone;
  private readonly spine1: THREE.Bone;
  private readonly spine2: THREE.Bone;
  private readonly neck: THREE.Bone;
  private readonly head: THREE.Bone;
  private readonly mouth: THREE.Bone;
  private readonly ears: THREE.Bone[];
  private readonly eyes: THREE.Bone[];
  private readonly tail: THREE.Bone[];
  private readonly legs: Leg[];
  /** 꼬리 마디 길이 (m)와 기준 방향 (모델 공간) */
  private readonly tailLen: number[] = [];
  private readonly tailDir: THREE.Vector3[] = [];
  /** 땅에 닿는 몸통·머리 판정용 정점 (기준 자세 모델 단위, 주로 따르는 뼈) */
  private readonly probes: { p: THREE.Vector3; n: THREE.Vector3; bone: number }[] = [];
  private readonly m4 = new THREE.Matrix4();
  private readonly rootInv = new THREE.Matrix4();
  private readonly collar = new THREE.Group();
  /** 털 겹: 같은 메시를 같은 뼈대에 묶어 겹마다 노멀 방향으로 부풀린다 */
  private readonly shells: { mesh: THREE.SkinnedMesh; layer: { value: number } }[] = [];

  private legScale = 1;
  private headScale = new THREE.Vector3(1, 1, 1);
  private eyeScale = 1;
  private tailScale = 1;
  private fold = false;
  private baseGirth = 1;
  private girth = 1;
  private firstPerson = false;
  private hipRestY = 0;

  private nextBlink = 2;
  private blinkUntil = 0;
  private earTwitch = { at: 3, side: 0, until: 0 };
  private readonly earTwitchAmt = [0, 0];
  private lastTime = 0;

  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly q1 = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly qTorso = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();

  get cycleLength(): number {
    return (STRIDE * this.legScale) / STANCE;
  }

  constructor(appearance: CatAppearance, gltfScene: THREE.Object3D) {
    let mesh: THREE.SkinnedMesh | null = null;
    gltfScene.traverse((o) => {
      if (!mesh && (o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
    });
    if (!mesh) throw new Error('cat.glb: SkinnedMesh가 없습니다');
    this.mesh = mesh;
    const skeleton = this.mesh.skeleton;
    this.bones = skeleton.bones;

    // 뼈와 메시를 원래 계층(축 변환·100배 확대가 섞여 있음)에서 꺼내 모델 그룹 아래에 둔다.
    // 바인드 행렬을 단위 행렬로 두면 정점 = 뼈 월드 × 역바인드 × 정점(모델 단위)이 된다.
    const rootBone = this.bones.find((b) => !(b.parent as THREE.Bone | null)?.isBone)!;
    this.model.scale.setScalar(MODEL_SCALE);
    this.root.add(this.model);
    this.model.add(rootBone);
    this.mesh.removeFromParent();
    this.mesh.position.set(0, 0, 0);
    this.mesh.quaternion.identity();
    this.mesh.scale.set(1, 1, 1);
    this.model.add(this.mesh);
    this.mesh.bind(skeleton, new THREE.Matrix4());
    skeleton.pose();
    this.root.updateMatrixWorld(true);
    this.mesh.frustumCulled = false; // 자세가 바뀌면 기준 자세 경계구가 맞지 않는다
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    const source = this.mesh.material as THREE.MeshStandardMaterial;
    this.mesh.material = createCatSkinMaterial(source, this.uniforms);
    for (let i = 0; i < MAX_SHELLS; i++) {
      const layer = { value: 1 };
      const shell = new THREE.SkinnedMesh(this.mesh.geometry, createCatSkinMaterial(source, this.uniforms, layer));
      this.model.add(shell);
      shell.bind(skeleton, new THREE.Matrix4());
      shell.frustumCulled = false;
      shell.castShadow = false;
      shell.receiveShadow = true;
      shell.visible = false;
      this.shells.push({ mesh: shell, layer });
    }

    for (const b of this.bones) {
      this.rest.set(b, {
        q: b.quaternion.clone(),
        pos: b.position.clone(),
        scale: b.scale.clone(),
        modelQ: b.getWorldQuaternion(new THREE.Quaternion()),
        rootPos: b.getWorldPosition(new THREE.Vector3()),
      });
    }

    const bone = (name: string) => {
      const b = this.bones.find((x) => norm(x.name) === norm(name));
      if (!b) throw new Error(`cat.glb: 뼈 ${name}이 없습니다`);
      return b;
    };
    this.torso = bone(BONES.torso);
    this.spine1 = bone(BONES.spine1);
    this.spine2 = bone(BONES.spine2);
    this.neck = bone(BONES.neck);
    this.head = bone(BONES.head);
    this.mouth = bone(BONES.mouth);
    this.ears = BONES.ears.map(bone);
    this.eyes = BONES.eyes.map(bone);
    this.tail = BONES.tail.map(bone);
    this.legs = LEG_DEFS.map((d) => {
      const bones = d.names.map(bone);
      const paw = this.rest.get(bones[bones.length - 1])!.rootPos;
      return { ...d, bones, standZ: paw.z, pawY: paw.y };
    });
    this.hipRestY = this.rest.get(this.legs[0].bones[0])!.rootPos.y;

    // 꼬리 마디: 다음 마디까지의 길이와 방향 (끝 마디는 꼬리 끝까지 약 0.24 모델 단위)
    for (let i = 0; i < this.tail.length; i++) {
      const a = this.rest.get(this.tail[i])!.rootPos;
      const next = i + 1 < this.tail.length ? this.rest.get(this.tail[i + 1])!.rootPos : a.clone().add(this.tailDir[i - 1].clone().multiplyScalar(0.24 * MODEL_SCALE));
      this.tailLen.push(a.distanceTo(next));
      this.tailDir.push(next.clone().sub(a).normalize());
    }

    this.collectProbes();
    this.buildCollar();
    // 캣캠: 원래 얼굴 앞(머리는 캣캠 중 숨김). 이 모델은 가슴이 앞발보다 앞으로 나와 있어
    // 어깨 위에 두면 가슴만 보이므로 얼굴 위치에 둔다 (앞발은 보이지 않는다)
    this.attachToBone(this.eyeAnchor, this.spine2, new THREE.Vector3(0, 2.6, 1.55));
    this.setAppearance(appearance);
  }

  setAppearance(a: CatAppearance): void {
    applyAppearanceToUniforms(this.uniforms, a);
    const kitten = a.stage === 'kitten';
    this.fold = a.ear === 'fold';
    this.root.scale.setScalar(effectiveScale(a.stage, a.size));
    const head = kitten ? 1.18 : 1;
    this.headScale.set(head * (this.fold ? 1.05 : 1), head * (this.fold ? 0.97 : 1), head);
    this.eyeScale = kitten ? 1.12 : 1;
    this.legScale = (kitten ? 0.86 : 1) * (this.fold ? 0.94 : 1);
    this.tailScale = kitten ? 0.8 : 1;
    this.collar.visible = a.accessory === 'heartTag';
    this.baseGirth = girthScale(a.build);
    this.setGirth(this.baseGirth);
    // 털 길이: 아기는 더 길고 보송하게 (도형 모델과 같은 값)
    this.uniforms.uFurLen.value = furLength(a.stage) / MODEL_SCALE;
  }

  /** 털 표현 품질: 겹 수 (0이면 겹 없음) */
  setFurQuality(q: ResolvedFurQuality): void {
    const n = shellCount(q);
    this.shells.forEach((s, i) => {
      s.mesh.visible = i < n;
      s.layer.value = (i + 1) / Math.max(1, n);
    });
  }

  /** 캣캠: 머리가 시야를 가리지 않게 머리를 숨긴다 (한 덩어리 메시라 레이어로 나눌 수 없다) */
  setFirstPerson(on: boolean): void {
    this.firstPerson = on;
  }

  twitchEar(): void {
    const t = this.lastTime;
    this.earTwitch = { at: t + 3 + Math.random() * 4, side: Math.random() < 0.5 ? 0 : 1, until: t + 0.25 };
  }

  apply(p: CatPose, time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.resetPose();

    const inflated = this.baseGirth * (1 + 0.28 * p.float);
    if (Math.abs(inflated - this.girth) > 1e-3) this.setGirth(inflated);

    // ---- 몸통
    const settle = Math.max(p.sit, p.lie, p.manSit);
    const rollA = p.roll * ROLL_MAX;
    const crouch = Math.max(0, p.headPitch - 0.55) * 0.8 * (1 - settle);
    let spinePitch = lerp(lerp(SPINE_STAND, SPINE_SIT, p.sit), SPINE_LIE, p.lie) + crouch + Math.sin(p.gaitPhase * Math.PI * 4 + 1) * 0.015 * p.speed;
    spinePitch = lerp(spinePitch, SPINE_MAN, p.manSit) + STRETCH_PITCH * p.stretch;
    const swayZ = p.float > 0.01 ? Math.sin(time * 0.9) * 0.06 * p.float : 0;
    const swayX = p.float > 0.01 ? Math.sin(time * 0.7 + 1) * 0.04 * p.float : 0;
    this.qTorso.setFromEuler(this.euler.set(spinePitch + swayX, 0, rollA + swayZ, 'ZXY'));
    this.setRel(this.torso, this.qTorso);
    const breathe = Math.sin(time * (p.lie > 0.5 ? 1.4 : 2.4)) * (p.lie > 0.5 ? 0.02 : 0.012);
    this.spine1.scale.multiplyScalar(1 + breathe * 0.5);
    this.setRel(this.spine2, this.q1.setFromEuler(this.euler.set(0, 0, Math.sin(p.gaitPhase * Math.PI * 2) * 0.03 * p.speed)));

    // 서 있을 때 높이 → 앉기·눕기는 몸통 가장 낮은 점이 땅에 닿는 높이로
    const bob = Math.sin(p.gaitPhase * Math.PI * 4) * 0.005 * p.speed;
    const pawY = this.legs[0].pawY;
    const standY = pawY + (this.hipRestY - pawY) * this.legScale - this.hipRestY + bob;

    // ---- 목·머리 (머리는 몸이 흔들려도 수평 유지. 몸을 굴리면 머리는 덜 따라 돈다)
    const neckPitch = 0.45 * p.lie + 0.2 * p.sit + Math.max(0, p.headPitch - 0.2) * 0.7 + 0.4 * p.manSit - 0.3 * p.stretch;
    this.setRel(this.neck, this.q1.setFromEuler(this.euler.set(neckPitch, 0, 0)));
    this.setRel(this.head, this.q1.setFromEuler(this.euler.set(p.headPitch - spinePitch - neckPitch, p.headYaw, p.headTilt - rollA * (0.5 + 0.18 * Math.max(0, p.roll * 2 - 1)), 'YXZ')));
    this.head.scale.multiply(this.headScale);
    if (this.firstPerson) this.head.scale.setScalar(1e-4);
    this.setRel(this.mouth, this.q1.setFromEuler(this.euler.set(Math.max(0, Math.sin(time * 18)) * 0.25 * p.lick, 0, 0)));

    this.updateEyes(p, time);
    this.updateEars(time, dt);

    // 서 있을 때 높이 → 앉기·눕기는 몸통·머리의 가장 낮은 점이 땅에 닿는 높이로
    this.model.position.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    const groundY = -this.lowestPoint() + 0.004 + 0.008 * p.tuck * p.lie;
    this.model.position.set(0, lerp(standY, groundY, settle), 0);
    this.root.updateMatrixWorld(true);
    this.updateTail(p, time, spinePitch);
    for (const leg of this.legs) this.solveLeg(leg, p, rollA);
  }

  // ---------------------------------------------------------------- 구성

  private resetPose(): void {
    for (const b of this.bones) {
      const r = this.rest.get(b)!;
      b.quaternion.copy(r.q);
      b.position.copy(r.pos);
      b.scale.copy(r.scale);
    }
    for (const leg of this.legs) leg.bones[0].scale.multiplyScalar(this.legScale);
    this.tail[0].scale.multiplyScalar(this.tailScale);
  }

  /** R(모델 축 기준 회전)만큼 기준 자세에서 돌린다. 부모가 돌아가 있으면 그 위에 더해진다 */
  private setRel(b: THREE.Bone, R: THREE.Quaternion): void {
    const r = this.rest.get(b)!;
    this.q2.copy(r.modelQ).invert().multiply(R).multiply(r.modelQ);
    b.quaternion.copy(r.q).multiply(this.q2);
  }

  private setGirth(g: number): void {
    this.girth = g;
    this.uniforms.uInflate.value = inflateFor(g);
  }

  /** 몸통에 붙은 정점 일부를 골라 둔다 (앉기·눕기 때 땅에 닿는 높이 계산용) */
  private collectProbes(): void {
    const geo = this.mesh.geometry;
    const pos = geo.getAttribute('position');
    const nrm = geo.getAttribute('normal');
    const idx = geo.getAttribute('skinIndex');
    const wgt = geo.getAttribute('skinWeight');
    const bodyBones = new Set([this.torso, this.spine1, this.spine2, this.neck, this.head].map((b) => this.bones.indexOf(b)));
    for (let i = 0; i < pos.count; i += 3) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (wgt.getComponent(i, k) > wgt.getComponent(i, best)) best = k;
      const bone = idx.getComponent(i, best);
      if (!bodyBones.has(bone)) continue;
      this.probes.push({ p: new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)), n: new THREE.Vector3(nrm.getX(i), nrm.getY(i), nrm.getZ(i)), bone });
    }
  }

  /** 지금 자세에서 몸통·머리 정점 중 가장 낮은 높이 (루트 기준 m). 정점은 주로 따르는 뼈 하나로 근사 */
  private lowestPoint(): number {
    const inflate = this.uniforms.uInflate.value;
    const inv = this.mesh.skeleton.boneInverses;
    this.rootInv.copy(this.root.matrixWorld).invert();
    let min = Infinity;
    for (const { p, n, bone } of this.probes) {
      this.m4.multiplyMatrices(this.rootInv, this.bones[bone].matrixWorld).multiply(inv[bone]);
      const y = this.v1.copy(n).multiplyScalar(inflate).add(p).applyMatrix4(this.m4).y;
      if (y < min) min = y;
    }
    return min;
  }

  /** 뼈에 물체를 붙인다. at은 기준 자세의 모델 단위 위치, 물체 안쪽은 성체 m 단위 */
  private attachToBone(obj: THREE.Object3D, b: THREE.Bone, at: THREE.Vector3, rotX = 0): void {
    const holder = new THREE.Object3D();
    b.add(holder);
    this.root.updateMatrixWorld(true);
    const boneInModel = this.model.matrixWorld.clone().invert().multiply(b.matrixWorld);
    const target = new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(1 / MODEL_SCALE));
    boneInModel.invert().multiply(target).decompose(holder.position, holder.quaternion, holder.scale);
    holder.add(obj);
  }

  /** 분홍 목걸이 + 하트 태그 (뽀리) */
  private buildCollar(): void {
    const band = new THREE.MeshStandardMaterial({ color: '#e0607e', roughness: 0.55 });
    const tagMat = new THREE.MeshStandardMaterial({ color: '#f39ab4', roughness: 0.3, metalness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.007, 8, 32), band);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.12, 1, 1);
    this.collar.add(ring);
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.5);
    heart.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.5, 0.25);
    heart.bezierCurveTo(-0.45, 0.55, -0.1, 0.55, 0, 0.3);
    heart.bezierCurveTo(0.1, 0.55, 0.45, 0.55, 0.5, 0.25);
    heart.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.5);
    const tag = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), tagMat);
    tag.scale.setScalar(0.026);
    tag.position.set(0, -0.018, 0.07);
    this.collar.add(tag);
    this.collar.traverse((o) => {
      o.castShadow = true;
      o.layers.set(HEAD_LAYER);
    });
    this.attachToBone(this.collar, this.neck, new THREE.Vector3(0, 2.05, 1.12), 0.35);
  }

  // ---------------------------------------------------------------- 애니메이션

  private updateEyes(p: CatPose, time: number): void {
    if (time > this.nextBlink) {
      this.blinkUntil = time + 0.13;
      this.nextBlink = time + 2.5 + Math.random() * 4;
    }
    const closed = Math.max(p.eyesClosed, time < this.blinkUntil ? 1 : 0);
    for (const e of this.eyes) e.scale.set(this.eyeScale, this.eyeScale * lerp(1, 0.06, closed), this.eyeScale);
  }

  private updateEars(time: number, dt: number): void {
    if (time > this.earTwitch.at) {
      this.earTwitch = { at: time + 3 + Math.random() * 6, side: Math.random() < 0.5 ? 0 : 1, until: time + 0.25 };
    }
    this.ears.forEach((ear, i) => {
      const side = i === 0 ? 1 : -1;
      const amp = this.fold ? -0.25 : -0.5;
      const target = time < this.earTwitch.until && i === this.earTwitch.side ? amp : 0;
      this.earTwitchAmt[i] += (target - this.earTwitchAmt[i]) * damp(20, dt);
      // 접힌 귀: 앞으로 접어 머리에 붙이고 안쪽으로 눕힌다
      const fx = this.fold ? 1.25 : 0;
      const fz = this.fold ? 0.3 * side : 0;
      this.setRel(ear, this.q1.setFromEuler(this.euler.set(fx + this.earTwitchAmt[i], 0, fz)));
      if (this.fold) ear.scale.set(1.05, 0.62, 1);
    });
  }

  private updateTail(p: CatPose, time: number, spinePitch: number): void {
    const n = this.tail.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // 도형 모델(9마디)의 굽힘을 5마디에 나눠 담는다
      const upCurve = i === 0 ? 1.25 : t > 0.7 ? 0.5 : -0.18;
      const downCurve = i === 0 ? -0.95 : i === 1 ? 0.6 : 0.1;
      const curlSide = i === 0 ? 0 : (p.sit + p.lie) * 0.4;
      const wave = Math.sin(time * (2.2 + p.tailWag * 2) - i * 1.0) * p.tailWag * (0.14 + t * 0.32);
      // 꼬리는 몸통에 붙어 있어 몸통 기울기를 따라간다. 도형 모델처럼 엉덩이 기준이 되게 되돌린다
      const comp = i === 0 ? -spinePitch : 0;
      this.setRel(this.tail[i], this.q1.setFromEuler(this.euler.set(lerp(downCurve, upCurve, p.tailUp) + comp, curlSide + wave, 0)));
    }
    if (p.tailWrap > 0.001) this.wrapTail(p, time);
  }

  /**
   * 꼬리 감기: 꼬리 뿌리에서 엉덩이 뒤 바닥으로 내려간 뒤 몸 옆을 원을 따라 돌아 앞을 향한다.
   * 각 마디가 이 경로 방향을 향하게 하는 회전으로 섞는다 (도형 모델과 같은 방식).
   */
  private wrapTail(p: CatPose, time: number): void {
    const toRoot = (o: THREE.Object3D, out: THREE.Vector3) => this.root.worldToLocal(o.getWorldPosition(out));
    const base = toRoot(this.tail[0], this.v2.set(0, 0, 0)).clone();
    const hipZ = toRoot(this.legs[0].bones[0], this.v3).z;
    const groundY = 0.016;
    const r = 0.1 * this.girth + 0.028;
    const cz = hipZ - 0.02;
    const startA = 0.25;
    const start = new THREE.Vector3(r * Math.sin(startA), groundY, cz - r * Math.cos(startA));
    const drop = base.distanceTo(start);
    const at = (d: number, out: THREE.Vector3) => {
      if (d <= drop) return out.lerpVectors(base, start, d / drop);
      const a = startA + (d - drop) / r;
      return out.set(r * Math.sin(a), groundY, cz - r * Math.cos(a));
    };
    const rootQInv = this.root.getWorldQuaternion(this.q1).invert().clone();
    let d = 0;
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    for (let i = 0; i < this.tail.length; i++) {
      const len = this.tailLen[i] * this.tailScale;
      const dir = at(d + len, p1).sub(at(d, p0)).normalize();
      d += len;
      const wave = Math.sin(time * 2 - i) * p.tailWag * 0.1;
      const want = new THREE.Quaternion().setFromUnitVectors(this.tailDir[i], dir).multiply(this.rest.get(this.tail[i])!.modelQ);
      want.premultiply(this.q2.setFromAxisAngle(this.v3.set(0, 1, 0), wave));
      // 부모의 지금 모델 공간 회전 기준 로컬 회전
      const parentQ = this.tail[i].parent!.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQInv);
      const local = parentQ.invert().multiply(want);
      this.tail[i].quaternion.slerp(local, p.tailWrap);
      this.tail[i].updateMatrixWorld(true);
    }
  }

  private solveLeg(leg: Leg, p: CatPose, rollA: number): void {
    const toRoot = (o: THREE.Object3D, out: THREE.Vector3) => this.root.worldToLocal(o.getWorldPosition(out));
    const top = toRoot(leg.bones[0], new THREE.Vector3());
    const sy = top.y;
    const sz = top.z;
    const ls = this.legScale;
    const hipZ = this.rest.get(this.legs[0].bones[0])!.rootPos.z;

    let fz = leg.standZ;
    let fy = 0;
    if (p.speed > 0.01) {
      const c = (((p.gaitPhase + leg.phaseOffset) % 1) + 1) % 1;
      if (c < STANCE) {
        fz += lerp(STRIDE / 2, -STRIDE / 2, c / STANCE) * p.speed * ls;
      } else {
        const s = (c - STANCE) / (1 - STANCE);
        fz += lerp(-STRIDE / 2, STRIDE / 2, s) * p.speed * ls;
        fy += Math.sin(s * Math.PI) * FOOT_LIFT * p.speed;
      }
    }
    // 앉기: 뒷발은 엉덩이 앞으로, 앞발은 가슴 아래로. 엎드리기: 앞발은 가슴 앞, 뒷발은 배 아래
    const sitZ = leg.front ? sz + 0.01 : hipZ + 0.05;
    const lieZ = leg.front ? sz + 0.04 : hipZ + 0.045;
    fz = lerp(lerp(fz, sitZ, p.sit), lieZ, p.lie);
    fy = lerp(fy, leg.front ? 0.008 : 0.012, p.lie);
    if (leg.front) {
      const tk = p.tuck * p.lie;
      fz = lerp(fz, sz - 0.02, tk);
      fy = lerp(fy, 0.025, tk);
      fz = lerp(fz, sz + 0.13, p.stretch);
      fy = lerp(fy, 0, p.stretch);
    } else {
      fz = lerp(fz, leg.standZ - 0.02, p.stretch);
      fz = lerp(fz, hipZ + 0.11, p.manSit);
      fy = lerp(fy, 0.008, p.manSit);
    }
    if (p.float > 0.001) {
      const paddle = Math.sin(this.lastTime * 2.2 + leg.phaseOffset * Math.PI * 2) * 0.02;
      fy = lerp(fy, sy - 0.3, p.float);
      fz = lerp(fz, sz + paddle, p.float);
    }
    const target = this.v1.set(top.x, fy + leg.pawY, fz);

    // 그루밍: 오른쪽 앞발을 입이나 얼굴로
    if (leg.front && leg.side === -1 && p.pawLift > 0.001) {
      const m = toRoot(this.mouth, new THREE.Vector3());
      const wipe = Math.sin(this.lastTime * 7) * 0.015 * p.pawToFace;
      const g = new THREE.Vector3(lerp(m.x - 0.01, -0.03, p.pawToFace), lerp(m.y - 0.035, m.y + 0.03 + wipe, p.pawToFace), lerp(m.z + 0.01, m.z - 0.03, p.pawToFace));
      target.lerp(g, p.pawLift);
    }

    // 몸을 굴렸거나 아저씨 앉기 앞발: 몸 기준 방향으로 다리 자세를 정한다
    const rollW = Math.min(1, p.roll * 2);
    const manW = leg.front ? p.manSit : 0;
    const w = Math.max(rollW, manW);
    if (w > 0.001) {
      let bz: number;
      let by: number;
      if (manW >= rollW) {
        bz = -0.07;
        by = -0.075;
      } else {
        const belly = Math.max(0, p.roll * 2 - 1);
        bz = lerp(leg.front ? 0.07 : -0.05, leg.front ? 0.035 : 0.04, belly);
        by = lerp(-0.185, leg.front ? -0.085 : -0.11, belly);
      }
      const body = this.v2.set(0, by * LEG_K * ls, bz * LEG_K * ls).applyQuaternion(this.qTorso).add(top);
      target.lerp(body, w);
    }

    const bones = leg.bones;
    const worldT = this.root.localToWorld(target.clone());
    const bend = this.v3.set(1, 0, 0).applyQuaternion(this.root.getWorldQuaternion(this.q1));
    if (leg.front) {
      solveTwoBoneIK(bones[0], bones[1], bones[2], worldT, bend);
    } else {
      // 뒷다리: 허벅지·정강이로 발목(뒤꿈치)을 맞추고, 발목→발 방향을 따로 맞춘다.
      // 서 있을 때는 발목이 발 위에, 앉거나 누우면 발등이 바닥에 눕는다
      const flat = Math.max(p.sit, p.lie, p.manSit, rollW);
      const hock = new THREE.Vector3(0, lerp(0.06, 0.012, flat) * ls, lerp(-0.004, -0.05, flat) * ls);
      if (rollW > 0.001) hock.applyQuaternion(this.q1.identity().slerp(this.qTorso, rollW));
      const hockT = this.root.localToWorld(target.clone().add(hock));
      solveTwoBoneIK(bones[0], bones[1], bones[2], hockT, bend);
      const from = bones[3].getWorldPosition(new THREE.Vector3()).sub(bones[2].getWorldPosition(new THREE.Vector3())).normalize();
      const to = worldT.clone().sub(bones[2].getWorldPosition(new THREE.Vector3())).normalize();
      const q = bones[2].getWorldQuaternion(new THREE.Quaternion()).premultiply(this.q1.setFromUnitVectors(from, to));
      setWorldQuaternion(bones[2], q);
      bones[2].updateMatrixWorld(true);
    }
    // 발바닥은 바닥과 나란히 (누우면 몸을 따라)
    const foot = bones[bones.length - 1];
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const flatQ = rootQ.clone().multiply(this.rest.get(foot)!.modelQ);
    const bodyQ = rootQ.clone().multiply(this.qTorso).multiply(this.rest.get(foot)!.modelQ);
    setWorldQuaternion(foot, flatQ.slerp(bodyQ, Math.max(w, rollA > 0 ? rollW : 0)));
  }
}
