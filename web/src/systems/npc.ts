import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { asBakedMaterial } from '../world/propModels';
import type { ResidentKind } from '../world/map/neighborhood';

const { damp, clamp } = THREE.MathUtils;

/** 주민 모델 파일 (tools/blender/npc.py가 만든다. 부위: body, head(원점 = 목), armL·armR(원점 = 어깨)) */
export const RESIDENT_FILES: Record<ResidentKind, string> = { santa: 'resident-santa.glb', rudolph: 'resident-rudolph.glb' };
export type ResidentModels = Partial<Record<ResidentKind, THREE.Object3D>>;

/** 고양이가 이만큼 다가오면 고개를 돌려 바라본다 (m) */
const LOOK_DIST = 4;
/** 그릇 채우기: 고양이가 이만큼 가까우면, 잠깐 뒤에, 한 번 채우면 한동안 쉰다 (m, 초) */
const REFILL = { dist: 2.2, delay: 1.5, cooldown: 20, pourTime: 1.2 };
/** 고양이가 이만큼 다가오면 손을 흔든다 (m) */
export const WAVE_DIST = 3;
/** 손 흔들기: 한 번 흔드는 시간, 다시 흔들 때까지 쉬는 시간 (초) */
const WAVE_TIME = 3;
const WAVE_COOLDOWN = 12;
/** 흔드는 팔: 바깥 위로 드는 각도, 좌우로 흔드는 폭·빠르기, 앞으로 내미는 각도 (rad) */
const WAVE_ARM = { lift: 2.4, swing: 0.25, swingSpeed: 9, forward: 0.25 };
/** 산타가 웃는 거리 (m) */
const LAUGH_DIST = 2.5;
/** 몸 움직임: 숨쉬기 오르내림, 좌우 흔들림, 웃을 때 들썩임 (m·rad, 빠르기는 rad/s) */
const BODY = { breath: 0.003, breathSpeed: 2.2, sway: 0.012, swaySpeed: 0.7, laugh: 0.014, laughSpeed: 11 };

/** 주민별 얼굴 높이(고양이가 쳐다볼 자리)와 몸 반지름(충돌). 모델이 없으면 도형 주민 값 */
const SHAPE: Record<ResidentKind | 'capsule', { face: number; radius: number }> = {
  capsule: { face: 1.55, radius: 0.28 },
  santa: { face: 1.53, radius: 0.34 }, // 목 1.40 + 얼굴 가운데 0.13, 배가 나와 넓다
  rudolph: { face: 1.59, radius: 0.28 }, // 목 1.46 + 0.13
};

export interface ResidentOptions {
  /** 부위가 나뉜 모델 (RESIDENT_FILES). 없으면 도형 주민 */
  model?: THREE.Object3D | null;
  kind?: ResidentKind;
  /** 빈 그릇을 채워 주는 주민인가 (기본 true: 맵마다 한 명) */
  feeds?: boolean;
}

/** 움직이는 부위: 고개, 먹이 붓는 팔, 손 흔드는 팔 (모델 주민만) */
interface Parts {
  head: THREE.Object3D;
  pourArm: THREE.Object3D;
  waveArm: THREE.Object3D | null;
}

/**
 * 주민 NPC (기획서 12.2). 급식소 근처에 서 있고, 고양이가 다가오면 고개를 돌려 바라본다.
 * 그릇이 비어 있을 때 고양이가 오면 먹이를 채워 준다. (기획서 8.2)
 * 눈 오는 광장에서는 Blender 모델 주민(산타·루돌프, 4단계): 숨쉬듯 흔들리고, 고양이가 오면 손을 흔들며, 산타는 웃듯이 들썩인다
 */
export class Resident {
  readonly group = new THREE.Group();
  /** 몸 전체를 흔드는 자리 (숨쉬기·웃음) */
  readonly root = new THREE.Group();
  /** 손 흔드는 팔 (모델 주민만, 도형 주민은 null) */
  readonly waveArm: THREE.Object3D | null;
  readonly faceHeight: number;
  readonly radius: number;
  private readonly head: THREE.Object3D;
  private readonly pourArm: THREE.Object3D;
  /** 모델 주민 종류 (도형 주민은 null) */
  private readonly kind: ResidentKind | null;
  private readonly feeds: boolean;
  /** 주민마다 숨쉬기 박자를 어긋나게 */
  private readonly phase: number;
  private refillAt = -1;
  private lastRefill = -100;
  private wasNear = false;
  private waveStart = -100;
  /** 0~1: 손 흔들기·웃음이 얼마나 켜졌나 (부드럽게 들어가고 빠진다) */
  private wave = 0;
  private laugh = 0;

  constructor(
    public readonly x: number,
    public readonly z: number,
    private readonly facing: number,
    opts: ResidentOptions = {},
  ) {
    this.feeds = opts.feeds ?? true;
    this.phase = (x * 7.3 + z * 3.1) % (Math.PI * 2);
    this.group.add(this.root);
    let parts: Parts;
    if (opts.model && opts.kind) {
      this.kind = opts.kind;
      parts = attachModel(this.root, opts.model);
    } else {
      this.kind = null;
      parts = capsule(this.root);
    }
    this.head = parts.head;
    this.pourArm = parts.pourArm;
    this.waveArm = parts.waveArm;
    const shape = SHAPE[this.kind ?? 'capsule'];
    this.faceHeight = shape.face;
    this.radius = shape.radius;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = facing;
  }

  /** 그릇을 채울 때가 되면 true */
  update(now: number, dt: number, cat: { x: number; z: number }, bowlEmpty: boolean): boolean {
    const dist = Math.hypot(cat.x - this.x, cat.z - this.z);
    this.lookAtCat(now, dt, cat, dist);
    const refill = this.tickRefill(now, dist, bowlEmpty);
    this.animatePour(now, dt);
    if (this.kind) {
      this.animateWave(now, dt, dist);
      this.animateBody(now, dt, dist);
    }
    return refill;
  }

  /** 고개가 고양이를 따라간다. 멀면 천천히 두리번거린다 */
  private lookAtCat(now: number, dt: number, cat: { x: number; z: number }, dist: number): void {
    const near = dist < LOOK_DIST;
    const local = Math.atan2(cat.x - this.x, cat.z - this.z) - this.facing;
    const wrapped = Math.atan2(Math.sin(local), Math.cos(local));
    const yaw = near ? clamp(wrapped, -1, 1) : Math.sin(now * 0.2) * 0.3;
    const pitch = near ? 0.35 : 0.1;
    this.head.rotation.y = damp(this.head.rotation.y, yaw, 3, dt);
    this.head.rotation.x = damp(this.head.rotation.x, pitch, 3, dt);
  }

  /** 빈 그릇 곁에 고양이가 오면 잠깐 뒤에 채운다. 채우는 순간 true */
  private tickRefill(now: number, dist: number, bowlEmpty: boolean): boolean {
    const waiting = this.refillAt > 0;
    if (this.feeds && bowlEmpty && dist < REFILL.dist && !waiting && now - this.lastRefill > REFILL.cooldown) this.refillAt = now + REFILL.delay;
    if (this.refillAt <= 0 || now < this.refillAt) return false;
    this.refillAt = -1;
    this.lastRefill = now;
    return true;
  }

  /** 먹이를 붓는 동안 팔을 앞으로 든다 */
  private animatePour(now: number, dt: number): void {
    const pouring = now - this.lastRefill < REFILL.pourTime || this.refillAt > 0;
    this.pourArm.rotation.x = damp(this.pourArm.rotation.x, pouring ? -0.9 : 0, 5, dt);
  }

  /** 고양이가 다가오면 한 번 손을 흔들고 내린다 (곁에 계속 있어도 다시 흔들지 않는다) */
  private animateWave(now: number, dt: number, dist: number): void {
    if (!this.waveArm) return;
    const near = dist < WAVE_DIST;
    if (near && !this.wasNear && now - this.waveStart > WAVE_COOLDOWN) this.waveStart = now;
    this.wasNear = near;
    const waving = now - this.waveStart < WAVE_TIME;
    this.wave = damp(this.wave, waving ? 1 : 0, 6, dt);
    // 바깥(-x) 위로 들어 좌우로 흔든다
    const a = WAVE_ARM;
    this.waveArm.rotation.z = -this.wave * (a.lift + a.swing * Math.sin(now * a.swingSpeed));
    this.waveArm.rotation.x = -this.wave * a.forward;
  }

  /** 숨쉬듯 오르내리고 살짝 흔들린다. 산타는 고양이가 가까우면 웃듯이 들썩인다 */
  private animateBody(now: number, dt: number, dist: number): void {
    const laughing = this.kind === 'santa' && dist < LAUGH_DIST;
    this.laugh = damp(this.laugh, laughing ? 1 : 0, 4, dt);
    const b = BODY;
    const breath = b.breath * Math.sin(now * b.breathSpeed + this.phase);
    const bounce = this.laugh * b.laugh * Math.abs(Math.sin(now * b.laughSpeed));
    this.root.position.y = breath + bounce;
    this.root.rotation.z = b.sway * Math.sin(now * b.swaySpeed + this.phase);
  }
}

/** Blender 모델을 복제해 붙이고 움직일 부위를 찾는다 (오른팔이 먹이를 붓고, 왼팔이 손을 흔든다) */
function attachModel(parent: THREE.Object3D, source: THREE.Object3D): Parts {
  const model = source.clone();
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  parent.add(model);
  return {
    head: model.getObjectByName('head')!,
    pourArm: model.getObjectByName('armR')!,
    waveArm: model.getObjectByName('armL')!,
  };
}

/** 예전 도형 주민 (다른 맵). 손은 흔들지 않는다 */
function capsule(parent: THREE.Object3D): Parts {
  const m = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const add = (to: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    to.add(mesh);
    return mesh;
  };
  for (const s of [-1, 1]) add(parent, new THREE.CapsuleGeometry(0.07, 0.7, 4, 8), m('#4a5160'), 0.1 * s, 0.45, 0);
  add(parent, new THREE.CapsuleGeometry(0.19, 0.5, 6, 12), m('#c98b6b'), 0, 1.15, 0);
  const pourArm = new THREE.Group();
  pourArm.position.set(0.24, 1.38, 0);
  add(pourArm, new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), m('#c98b6b'), 0, -0.28, 0);
  parent.add(pourArm);
  const otherArm = add(parent, new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), m('#c98b6b'), -0.24, 1.1, 0);
  otherArm.rotation.z = -0.1;
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  add(head, new THREE.SphereGeometry(0.13, 16, 12), m('#e9c3a3'), 0, 0, 0);
  add(head, new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m('#3a3330'), 0, 0.02, -0.01);
  parent.add(head);
  return { head, pourArm, waveArm: null };
}

/** 주민 모델을 불러온다. 빛나는 재질(루돌프 코)은 소품과 같이 정점 색을 그대로 보이는 glow로. 실패한 것은 도형 주민으로 */
export async function loadResidentModels(loader: GLTFLoader, base: string): Promise<ResidentModels> {
  const out: ResidentModels = {};
  await Promise.all(
    (Object.keys(RESIDENT_FILES) as ResidentKind[]).map(async (kind) => {
      try {
        const gltf = await loader.loadAsync(`${base}assets/models/${RESIDENT_FILES[kind]}`);
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(asBakedMaterial) : asBakedMaterial(mesh.material);
        });
        out[kind] = gltf.scene;
      } catch (err) {
        console.warn(`주민 모델을 불러오지 못해 도형 주민으로 대신합니다: ${kind}`, err);
      }
    }),
  );
  return out;
}
