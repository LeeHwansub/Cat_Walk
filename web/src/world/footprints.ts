import * as THREE from 'three';

/** 발자국 판 수: 오래된 것부터 돌려 쓴다 (보드 X-05) */
export const FOOTPRINT_MAX = 60;
/** 발자국이 또렷이 남는 시간 (초) */
export const FOOTPRINT_LIFE = 20;
/** 그 뒤 눈에 묻혀 사라지는 시간 (초) */
export const FOOTPRINT_FADE = 3;

/** 갓 찍힌 발자국 색 (눈 위 그늘진 자국) */
const FRESH = new THREE.Color('#b4bfd2');
/** 눈 오는 광장 바깥 눈밭 색 (xmas.ts ground): 이 색이 되면 보이지 않는다 */
const SNOW = new THREE.Color('#eef2f9');
/** 몸 가운데에서 발까지 옆으로 (m, 크기 1 기준) */
const SIDE = 0.05;
/** 눈밭(y −0.02) 바로 위 */
const Y = -0.012;

export type Side = 'L' | 'R';

/**
 * 걸음 위상(0~1, CatController.gaitPhase)이 0과 0.5를 지날 때 한 발씩: 0은 왼발, 0.5는 오른발. 지난 차례대로
 */
export function stepsCrossed(prev: number, cur: number): Side[] {
  const out: Side[] = [];
  const wrapped = cur < prev;
  if (wrapped) {
    if (prev < 0.5) out.push('R');
    out.push('L');
    if (cur >= 0.5) out.push('R');
  } else if (prev < 0.5 && cur >= 0.5) out.push('R');
  return out;
}

/**
 * 눈 위 발자국 (눈 오는 광장 자동 반응, 보드 X-05): 발바닥 모양 판 60개를 InstancedMesh 하나로(그리기 1회).
 * 20초 동안 남았다가 3초에 걸쳐 눈 색으로 묻힌다. 사라질 때 투명도 대신 색을 눈밭 색으로 옮긴다
 * (같은 조명을 받는 같은 재질이라 다 옮겨지면 보이지 않고, 인스턴스마다 투명도를 따로 줄 필요가 없다)
 */
export class Footprints {
  readonly mesh: THREE.InstancedMesh;
  private readonly born = new Float32Array(FOOTPRINT_MAX).fill(-1);
  private next = 0;
  private readonly tmp = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor() {
    const geo = new THREE.PlaneGeometry(0.075, 0.09);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI); // 눕히면 그림 위쪽(발가락)이 뒤(-z)를 향하므로 돌려 앞(+z)으로
    const mat = new THREE.MeshStandardMaterial({ map: pawTexture(), alphaTest: 0.5, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, FOOTPRINT_MAX);
    this.mesh.name = 'footprints';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // 자국이 맵 여기저기 흩어져 있다
    for (let i = 0; i < FOOTPRINT_MAX; i++) {
      this.hide(i);
      this.mesh.setColorAt(i, SNOW);
    }
  }

  /** 지금 남아 있는 발자국 수 */
  get active(): number {
    let n = 0;
    for (const b of this.born) if (b >= 0) n++;
    return n;
  }

  /** heading: 고양이가 보는 방향 (0 = +z). 왼발은 진행 방향 왼쪽(+z를 보면 +x)에 */
  add(x: number, z: number, heading: number, side: Side, now: number, scale = 1): void {
    const i = this.next;
    this.next = (this.next + 1) % FOOTPRINT_MAX;
    const s = side === 'L' ? 1 : -1;
    this.tmp.position.set(x + Math.cos(heading) * SIDE * scale * s, Y, z - Math.sin(heading) * SIDE * scale * s);
    this.tmp.rotation.set(0, heading, 0);
    this.tmp.scale.setScalar(scale);
    this.tmp.updateMatrix();
    this.mesh.setMatrixAt(i, this.tmp.matrix);
    this.mesh.setColorAt(i, FRESH);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.born[i] = now;
  }

  /** 오래된 발자국을 눈 색으로 묻고, 다 묻힌 것은 치운다 */
  update(now: number): void {
    let changed = false;
    for (let i = 0; i < FOOTPRINT_MAX; i++) {
      const b = this.born[i];
      if (b < 0) continue;
      const age = now - b;
      if (age < FOOTPRINT_LIFE) continue;
      if (age >= FOOTPRINT_LIFE + FOOTPRINT_FADE) {
        this.born[i] = -1;
        this.hide(i);
        this.mesh.setColorAt(i, SNOW);
      } else {
        this.mesh.setColorAt(i, this.color.copy(FRESH).lerp(SNOW, (age - FOOTPRINT_LIFE) / FOOTPRINT_FADE));
      }
      changed = true;
    }
    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.needsUpdate = true;
    }
  }

  /** 모두 지운다 (맵을 바꿀 때) */
  clear(): void {
    for (let i = 0; i < FOOTPRINT_MAX; i++) {
      this.born[i] = -1;
      this.hide(i);
    }
    this.next = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private hide(i: number): void {
    this.tmp.position.set(0, -10, 0);
    this.tmp.scale.setScalar(0);
    this.tmp.updateMatrix();
    this.mesh.setMatrixAt(i, this.tmp.matrix);
  }
}

/** 고양이 발바닥 모양 (큰 볼록살 하나 + 앞쪽 발가락 넷). 캔버스 없이 만든다 */
function pawTexture(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  // [가운데 x, y, 반지름 x, 반지름 y] (0~1, y가 클수록 앞쪽)
  const blobs: [number, number, number, number][] = [
    [0.5, 0.32, 0.24, 0.2],
    [0.2, 0.62, 0.09, 0.11],
    [0.39, 0.78, 0.09, 0.11],
    [0.61, 0.78, 0.09, 0.11],
    [0.8, 0.62, 0.09, 0.11],
  ];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      const inside = blobs.some(([cx, cy, rx, ry]) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = inside ? 255 : 0;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}
