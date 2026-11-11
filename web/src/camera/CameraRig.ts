import * as THREE from 'three';
import { HEAD_LAYER } from '../cat/rig';
import { bodyFade, clearDistance, nextDistance } from './collision';

export type CameraMode = 'follow' | 'cat';

const MIN_DIST = 0.7;
const MAX_DIST = 7;
const EYE_HEIGHT = 0.24;

/**
 * 카메라 두 대 (D-04):
 * - follow: 고양이 눈높이로 낮춘 3인칭. 드래그 회전, 휠 줌
 * - cat: 캣캠(1인칭). 머리 메시는 숨기고 화면 아래에 앞발이 보인다
 */
export class CameraRig {
  readonly follow: THREE.PerspectiveCamera;
  readonly catCam: THREE.PerspectiveCamera;
  mode: CameraMode = 'follow';

  yaw = 0;
  pitch = 0.16;
  distance = 1.7;
  /** 캣캠 시선 보정 (드래그로 조정) */
  private lookYaw = 0;
  private lookPitch = 0;
  private lastManual = -10;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private readonly raycaster = new THREE.Raycaster();
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly smoothPos = new THREE.Vector3();
  private readonly smoothQuat = new THREE.Quaternion();
  /** 3인칭: 부드럽게 따라가는 바라보는 점, 벽을 고려한 지금 거리 */
  private readonly smoothTarget = new THREE.Vector3();
  private camDist = 0;
  /** 고양이를 얼마나 보이게 할지 (1 = 다 보임). 3인칭 카메라가 바짝 붙으면 줄어든다 */
  bodyFade = 1;
  private initialized = false;
  /** 메뉴·생성 화면에서 자동 회전 */
  orbit = 0;

  constructor(aspect: number) {
    this.follow = new THREE.PerspectiveCamera(50, aspect, 0.05, 250);
    this.follow.layers.enable(HEAD_LAYER);
    this.catCam = new THREE.PerspectiveCamera(90, aspect, 0.012, 250);
  }

  get active(): THREE.PerspectiveCamera {
    return this.mode === 'cat' ? this.catCam : this.follow;
  }

  attach(dom: HTMLElement, now: () => number): void {
    // 카메라 회전은 첫 번째 손가락(포인터)만 따른다. 두 번째 손가락이 닿아도 시점이 튀지 않게
    let activeId: number | null = null;
    dom.addEventListener('pointerdown', (e) => {
      if (activeId !== null) return;
      activeId = e.pointerId;
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== activeId) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      this.lastManual = now();
      if (this.mode === 'follow') {
        this.yaw -= dx * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, -0.05, 1.25);
      } else {
        this.lookYaw = THREE.MathUtils.clamp(this.lookYaw - dx * 0.004, -1.2, 1.2);
        this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + dy * 0.003, -0.9, 0.5);
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      this.dragging = false;
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.mode !== 'follow') return;
        this.distance = THREE.MathUtils.clamp(this.distance * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST);
      },
      { passive: false },
    );
  }

  setAspect(aspect: number): void {
    for (const c of [this.follow, this.catCam]) {
      c.aspect = aspect;
      c.updateProjectionMatrix();
    }
  }

  setMode(mode: CameraMode, catHeading: number): void {
    this.mode = mode;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.initialized = false;
    if (mode === 'follow') this.yaw = catHeading;
  }

  update(
    dt: number,
    now: number,
    cat: { x: number; y?: number; z: number; heading: number; speed: number; scale: number },
    eyeAnchor: THREE.Object3D,
    occluders: THREE.Object3D[],
    reduceShake: boolean,
  ): void {
    if (this.mode === 'cat') {
      this.bodyFade = 1;
      this.updateCatCam(dt, eyeAnchor, reduceShake);
    } else this.updateFollow(dt, now, cat, occluders);
  }

  private updateFollow(dt: number, now: number, cat: { x: number; y?: number; z: number; heading: number; speed: number; scale: number }, occluders: THREE.Object3D[]): void {
    if (this.orbit !== 0) {
      this.yaw += this.orbit * dt;
    } else if (now - this.lastManual > 3 && cat.speed > 0.08) {
      // 드래그하지 않을 때 고양이가 걸으면 천천히 고양이 뒤로 돌아간다 (고양이 중심 자동 카메라)
      const diff = Math.atan2(Math.sin(cat.heading - this.yaw), Math.cos(cat.heading - this.yaw));
      this.yaw += diff * (1 - Math.exp(-0.8 * dt));
    }
    // y: 고양이 발 높이(계단·담 위, J-1) + 풍선으로 뜬 높이. 카메라도 따라 올라간다
    const target = this.tmpA.set(cat.x, EYE_HEIGHT * cat.scale + (cat.y ?? 0), cat.z);
    const dir = this.tmpB.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));

    // 카메라 거리·높이는 고양이 크기를 따른다 (작은 고양이는 더 가깝고 낮게)
    const want = this.distance * Math.pow(cat.scale, 0.8);
    // 고양이 움직임은 바라보는 점에서 부드럽게 따라간다 (카메라 위치는 이 점 + 방향 × 거리)
    if (!this.initialized) {
      this.smoothTarget.copy(target);
      this.camDist = want;
      this.initialized = true;
    } else {
      this.smoothTarget.lerp(target, 1 - Math.exp(-10 * dt));
    }
    // 벽·차를 뚫지 않게: 굵게(다섯 줄) 검사해 막히면 그 프레임에 바로 당기고, 풀리면 천천히 돌아간다 (D-43)
    const allowed = clearDistance(this.raycaster, this.smoothTarget, dir, want, occluders, cat.scale);
    this.camDist = nextDistance(this.camDist, allowed, dt);
    this.bodyFade = bodyFade(this.camDist, cat.scale);
    this.follow.position.copy(this.smoothTarget).addScaledVector(dir, this.camDist);
    this.follow.position.y = Math.max(0.08, this.follow.position.y);
    this.follow.lookAt(this.smoothTarget);
  }

  private updateCatCam(dt: number, eye: THREE.Object3D, reduceShake: boolean): void {
    eye.getWorldPosition(this.tmpA);
    const q = new THREE.Quaternion();
    eye.getWorldQuaternion(q);
    // 몸 방향(yaw)만 쓰고 기울기는 고정해서, 몸이 기울어도 수평선이 흔들리지 않게 한다
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const yaw = Math.atan2(fwd.x, fwd.z) + this.lookYaw;
    const pitch = 0.78 + this.lookPitch; // 앞발이 보일 만큼 아래를 본다
    const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw + Math.PI, 0, 'YXZ'));
    if (!this.initialized) {
      this.smoothPos.copy(this.tmpA);
      this.smoothQuat.copy(look);
      this.initialized = true;
    }
    const k = reduceShake ? 9 : 30;
    this.smoothPos.lerp(this.tmpA, 1 - Math.exp(-k * dt));
    this.smoothQuat.slerp(look, 1 - Math.exp(-k * 0.8 * dt));
    this.catCam.position.copy(this.smoothPos);
    this.catCam.quaternion.copy(this.smoothQuat);
  }
}
