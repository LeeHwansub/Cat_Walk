import * as THREE from 'three';
import { createRng } from '../core/rng';
import type { CatAppearance } from './appearance';
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
  cycleLength = STRIDE / STANCE;

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

  private readonly furMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  private readonly lightMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  private readonly pawMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  private readonly irisMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0, emissiveIntensity: 0.15 });

  private nextBlink = 2;
  private blinkUntil = 0;
  private earTwitch = { at: 3, side: 0, until: 0 };
  private lastTime = 0;
  private readonly tmp = new THREE.Vector3();

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
      case 'calico':
        this.furMat.map = calicoTexture(fur);
        this.lightMat.color.copy(white);
        this.pawMat.color.copy(white);
        break;
    }
    this.furMat.needsUpdate = true;
    this.irisMat.color.set(a.eyeColor);
    this.irisMat.emissive.set(a.eyeColor);

    const kitten = a.stage === 'kitten';
    this.root.scale.setScalar(kitten ? 0.62 : 1);
    this.headScaler.scale.setScalar(kitten ? 1.22 : 1);
  }

  apply(p: CatPose, time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;

    // 몸통: 서기 → 앉기 → 엎드리기 혼합
    const settle = Math.max(p.sit, p.lie);
    const bob = Math.sin(p.gaitPhase * Math.PI * 4) * 0.006 * p.speed;
    const breathe = Math.sin(time * (p.lie > 0.5 ? 1.4 : 2.4)) * (p.lie > 0.5 ? 0.02 : 0.012);
    const hipY = lerp(lerp(HIP_STAND, HIP_SIT, p.sit), HIP_LIE, p.lie) + bob * (1 - settle);
    // 고개를 깊이 숙이면(먹기·냄새 맡기) 앞쪽을 낮춰 앞다리를 굽힌다
    const crouch = Math.max(0, p.headPitch - 0.6) * 0.5 * (1 - settle);
    const spinePitch = lerp(lerp(SPINE_STAND, SPINE_SIT, p.sit), SPINE_LIE, p.lie) + crouch + Math.sin(p.gaitPhase * Math.PI * 4 + 1) * 0.015 * p.speed;
    this.hips.position.set(0, hipY, -0.13);
    this.spine.rotation.set(spinePitch, 0, Math.sin(p.gaitPhase * Math.PI * 2) * 0.03 * p.speed);
    this.chest.scale.set(1 + breathe, 1 + breathe, 1);

    // 목과 머리: 머리는 몸이 흔들려도 수평을 유지한다 (고양이 특유의 안정된 머리)
    // 머리를 숙일 때는 목도 함께 내려 입이 바닥(그릇, 풀)에 닿게 한다
    const neckPitch = lerp(-0.75, -0.2, p.lie) + p.sit * 0.25 + Math.max(0, p.headPitch - 0.2) * 0.9;
    this.neck.rotation.x = neckPitch;
    this.head.rotation.set(p.headPitch - spinePitch - neckPitch, p.headYaw, p.headTilt, 'YXZ');
    this.head.position.y = 0.075 + Math.sin(time * 18) * 0.004 * p.lick;

    this.updateEyes(p, time);
    this.updateEars(time, dt);
    this.updateTail(p, time);

    // 다리 IK: 몸통 자세가 정해진 뒤 어깨/엉덩이 위치를 계산해서 발을 지면에 딛게 한다
    this.root.updateMatrixWorld(true);
    for (const leg of this.legs) this.solveLeg(leg, p, spinePitch);
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
    add(this.hips, sphere(0.078), this.furMat, [0, 0.012, 0], [0.95, 0.95, 1.1]);
    add(this.spine, new THREE.CapsuleGeometry(0.07, 0.2, 8, 18), this.furMat, [0, 0.008, 0.13], [0.93, 1, 1], Math.PI / 2);
    this.chest.position.set(0, 0.008, 0.25);
    this.spine.add(this.chest);
    add(this.chest, sphere(0.08), this.furMat, [0, 0, 0], [0.92, 1, 1]);
    // 앞가슴 털: 캣캠에서는 앞발을 가리므로 머리와 같은 레이어에 둔다
    add(this.chest, sphere(0.058), this.lightMat, [0, -0.028, 0.035], [1, 1.05, 0.9]).layers.set(HEAD_LAYER);
    add(this.spine, sphere(0.06), this.lightMat, [0, -0.04, 0.13], [0.9, 0.7, 1.9]); // 배

    // 목·머리
    this.neck.position.set(0, 0.045, 0.3);
    this.spine.add(this.neck);
    const neckMesh = add(this.neck, new THREE.CapsuleGeometry(0.045, 0.05, 6, 12), this.furMat, [0, 0.035, 0]);
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
      add(root, new THREE.CapsuleGeometry(upperR, UPPER - upperR, 4, 10), this.furMat, [0, -UPPER / 2, 0]);
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
      add(seg, new THREE.CapsuleGeometry(r, TAIL_SEG_LEN * 0.9, 4, 10), this.furMat, [0, 0, -TAIL_SEG_LEN / 2], undefined, Math.PI / 2);
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
    add(h, sphere(0.042), this.furMat, [0.03, -0.022, 0.028], [1, 0.8, 0.9]); // 볼
    add(h, sphere(0.042), this.furMat, [-0.03, -0.022, 0.028], [1, 0.8, 0.9]);
    add(h, sphere(0.03), this.lightMat, [0, -0.03, 0.056], [1.3, 0.75, 0.85]); // 주둥이
    add(h, sphere(0.009, 10, 8), pink, [0, -0.014, 0.083], [1.4, 0.8, 0.6]); // 코

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
        fz += lerp(STRIDE / 2, -STRIDE / 2, c / STANCE) * p.speed;
      } else {
        const s = (c - STANCE) / (1 - STANCE);
        fz += lerp(-STRIDE / 2, STRIDE / 2, s) * p.speed;
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

    const ik = solveTwoBone(UPPER, LOWER, fz - sz, fy - sy, leg.bend);
    const parentPitch = leg.front ? spinePitch : 0;
    leg.root.rotation.x = -ik.upper - parentPitch;
    leg.knee.rotation.x = -ik.lower;
  }

  private updateEyes(p: CatPose, time: number): void {
    if (time > this.nextBlink) {
      this.blinkUntil = time + 0.13;
      this.nextBlink = time + 2.5 + Math.random() * 4;
    }
    const blink = time < this.blinkUntil ? 1 : 0;
    const closed = Math.max(p.eyesClosed, blink);
    for (const e of this.eyes) e.scale.y = lerp(1, 0.08, closed);
  }

  private updateEars(time: number, dt: number): void {
    if (time > this.earTwitch.at) {
      this.earTwitch = { at: time + 3 + Math.random() * 6, side: Math.random() < 0.5 ? 0 : 1, until: time + 0.25 };
    }
    this.ears.forEach((ear, i) => {
      const target = time < this.earTwitch.until && i === this.earTwitch.side ? -0.5 : 0;
      ear.rotation.x += (target - ear.rotation.x) * damp(20, dt);
    });
  }

  private updateTail(p: CatPose, time: number): void {
    const n = this.tail.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // 세운 꼬리: 위로 솟았다가 끝이 살짝 앞으로 말린 물음표 모양
      const upCurve = i === 0 ? 1.25 : t > 0.7 ? 0.28 : -0.1;
      // 내린 꼬리: 아래로 늘어졌다가 바닥을 따라 몸 옆으로 감김
      const downCurve = i === 0 ? -0.95 : i === 1 ? 0.55 : 0.05;
      const curlSide = i === 0 ? 0 : (p.sit + p.lie) * 0.22;
      const wave = Math.sin(time * (2.2 + p.tailWag * 2) - i * 0.55) * p.tailWag * (0.08 + t * 0.2);
      this.tail[i].rotation.set(lerp(downCurve, upCurve, p.tailUp), curlSide + wave, 0);
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
