import * as THREE from 'three';
import { rainStreakTexture } from '../textures';
import type { MapKit } from './kit';

/**
 * 건물 디테일 부품 (3단계 3-1, 기획 2-1): 창틀·방범창·실외기·빗물 자국·옥상 난간·전선·변압기·우편함·스티로폼 텃밭.
 * 모두 코드로 만든다 (외부 에셋 없음). 정적 메시는 구역 합치기(mergeStatic)로 재질별로 묶인다.
 */

/**
 * 디테일 재질은 몇 가지 색으로 묶는다. 재질마다 구역 합치기 묶음(그리기 호출)이 하나씩 생겨,
 * 부품마다 색을 따로 쓰면 그리기 호출이 약 15~20% 늘었다 (2026-11-08 측정)
 */
const light = (k: MapKit) => k.mat('#e6e4de', 0.7); // 창턱·창틀·실외기 몸통·스티로폼
const dark = (k: MapKit) => k.mat('#2f3336', 0.65); // 방범창·그릴·전선·우편함 칸
const metal = (k: MapKit) => k.mat('#9ea3a6', 0.5); // 앵글·난간·변압기·우편함

/** 외벽 텍스처(facadeTexture) 한 장 안의 창 위치 (128px 기준: 가로 28~100, 세로 34~84 위에서부터) */
const WIN_U0 = 28 / 128;
const WIN_U1 = 100 / 128;
const WIN_V0 = 1 - 84 / 128; // 아래에서부터
const WIN_V1 = 1 - 34 / 128;

export interface WindowRect {
  /** 창 가운데 x (월드) */
  x: number;
  /** 창 폭 */
  w: number;
  /** 창 아래·위 높이 (땅 기준) */
  y0: number;
  y1: number;
  /** 몇 번째 층 (0 = 1층) */
  floor: number;
}

/**
 * 외벽 텍스처가 그리는 창의 위치. 상자 앞면 텍스처는 v가 아래에서 위로, u는 +z 면이면 minX부터,
 * −z 면이면 maxX부터 늘어난다 (three.js BoxGeometry). 면 밖으로 잘리는 창은 뺀다
 */
export function windowRects(o: { minX: number; maxX: number; height: number; tileW: number; tileH: number; uFromMax: boolean }): WindowRect[] {
  const out: WindowRect[] = [];
  const width = o.maxX - o.minX;
  const w = o.tileW * (WIN_U1 - WIN_U0);
  for (let floor = 0; (floor + WIN_V1) * o.tileH <= o.height + 1e-6; floor++) {
    for (let i = 0; (i + WIN_U1) * o.tileW <= width + 1e-6; i++) {
      const u = (i + (WIN_U0 + WIN_U1) / 2) * o.tileW;
      out.push({ x: o.uFromMax ? o.maxX - u : o.minX + u, w, y0: (floor + WIN_V0) * o.tileH, y1: (floor + WIN_V1) * o.tileH, floor });
    }
  }
  return out;
}

export interface FacadeOptions {
  minX: number;
  maxX: number;
  /** 길 쪽 외벽 면의 z */
  faceZ: number;
  /** 외벽 면이 바라보는 방향 (길 쪽, ±1) */
  out: 1 | -1;
  height: number;
  tileW: number;
  tileH: number;
  /** 벽돌 외벽: 텍스처에 창이 없어 창(틀·유리)을 입체로 붙인다 */
  glass?: boolean;
  /** 실외기를 붙일지 (가게는 붙이지 않음) */
  ac?: boolean;
}

/** 외벽 디테일: 창턱, (벽돌이면) 창, 방범창, 벽걸이 실외기, 빗물 자국 */
export function facadeDetails(k: MapKit, f: FacadeOptions): void {
  const wins = windowRects({ minX: f.minX, maxX: f.maxX, height: f.height, tileW: f.tileW, tileH: f.tileH, uFromMax: f.out === -1 });
  const sill = light(k);
  const frame = light(k);
  const glass = k.mat('#4f6070', 0.25);
  const bar = dark(k);
  const streak = streakMaterial();
  const z = (d: number) => f.faceZ + f.out * d;
  for (const win of wins) {
    const h = win.y1 - win.y0;
    // 창턱: 창 아래로 튀어나온 턱
    k.box(win.w + 0.14, 0.05, 0.14, sill, win.x, win.y0 - 0.03, z(0.07), false);
    if (f.glass) {
      k.box(win.w, h, 0.04, frame, win.x, (win.y0 + win.y1) / 2, z(0.02), false);
      for (const s of [-1, 1]) k.box(win.w * 0.42, h * 0.84, 0.02, glass, win.x + s * win.w * 0.23, (win.y0 + win.y1) / 2, z(0.045), false);
    }
    // 방범창: 1·2층 창의 절반쯤
    if (win.floor <= 1 && k.rng() < 0.5) {
      const bz = z(0.1);
      for (let i = 0; i <= 5; i++) k.box(0.02, h + 0.06, 0.02, bar, win.x - win.w / 2 + (win.w * i) / 5, (win.y0 + win.y1) / 2, bz, false);
      for (const y of [win.y0 - 0.02, (win.y0 + win.y1) / 2, win.y1 + 0.02]) k.box(win.w + 0.04, 0.02, 0.02, bar, win.x, y, bz, false);
    }
    // 벽걸이 실외기: 2층 이상 창 옆, 앵글 받침 위
    if (f.ac !== false && win.floor >= 1 && k.rng() < 0.3) {
      const side = k.rng() < 0.5 ? -1 : 1;
      const ax = win.x + side * (win.w / 2 + 0.5);
      if (ax - 0.4 > f.minX && ax + 0.4 < f.maxX) acUnit(k, ax, win.y0 + 0.05, f.faceZ, f.out);
    }
    // 빗물 자국: 창턱 아래로 흘러내린 얼룩
    if (k.rng() < 0.4) {
      const len = 0.6 + k.rng() * 0.9;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(win.w * 0.8, len), streak);
      m.position.set(win.x, win.y0 - 0.06 - len / 2, z(0.006));
      if (f.out === -1) m.rotation.y = Math.PI;
      k.group.add(m);
    }
  }
}

let streakMat: THREE.MeshStandardMaterial | null = null;
function streakMaterial(): THREE.MeshStandardMaterial {
  streakMat ??= new THREE.MeshStandardMaterial({ map: rainStreakTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  // 같은 판 여러 장이라 구역 합치기에서 하나로 묶어도 된다 (안 묶으면 판마다 그리기 호출이 하나씩 늘었다)
  streakMat.userData.mergeable = true;
  return streakMat;
}

/** 에어컨 실외기 (벽걸이): 몸통 + 팬 그릴 + 앵글 받침. y는 받침 위 몸통 바닥 높이 */
export function acUnit(k: MapKit, x: number, y: number, faceZ: number, out: 1 | -1): void {
  const body = light(k);
  const grille = dark(k);
  const angle = metal(k);
  const d = 0.28;
  const cz = faceZ + out * (0.04 + d / 2);
  k.box(0.78, 0.56, d, body, x, y + 0.28, cz, false);
  fanGrille(k, x - 0.1, y + 0.28, cz + out * (d / 2 + 0.006), out, grille);
  // 앵글 받침: 몸통 아래 두 줄 + 벽으로 비스듬한 지지대
  for (const s of [-0.3, 0.3]) {
    k.box(0.04, 0.04, d + 0.06, angle, x + s, y - 0.02, faceZ + out * ((d + 0.06) / 2), false);
    const brace = k.box(0.03, 0.34, 0.03, angle, x + s, y - 0.15, faceZ + out * 0.12, false);
    brace.rotation.x = out * 0.75;
  }
}

/** 바닥형 실외기 (주차장·빈터): 충돌 있음 */
export function groundAcUnit(k: MapKit, x: number, z: number, out: 1 | -1, alongX = true): void {
  if (k.models.acUnit) {
    // 소품 모델(실외기)로: 팬이 모델의 앞(+z)에 있어 길 쪽(out)을 보게 돌린다. 충돌은 같은 크기
    const w = 0.82;
    const d = 0.34;
    k.prop('acUnit', x, z, alongX ? (out === 1 ? 0 : Math.PI) : (out === 1 ? Math.PI / 2 : -Math.PI / 2), { w, h: 0.62, d, color: '#e6e2d8' });
    k.solidRect(x - (alongX ? w : d) / 2, x + (alongX ? w : d) / 2, z - (alongX ? d : w) / 2, z + (alongX ? d : w) / 2, 0.55);
    return;
  }
  const body = light(k);
  const grille = dark(k);
  const w = 0.82;
  const d = 0.32;
  const m = k.box(alongX ? w : d, 0.62, alongX ? d : w, body, x, 0.31, z);
  if (!alongX) m.rotation.y = 0;
  if (alongX) fanGrille(k, x - 0.1, 0.33, z + out * (d / 2 + 0.006), out, grille);
  k.solidRect(x - (alongX ? w : d) / 2, x + (alongX ? w : d) / 2, z - (alongX ? d : w) / 2, z + (alongX ? d : w) / 2, 0.62);
}

function fanGrille(k: MapKit, x: number, y: number, z: number, out: 1 | -1, mat: THREE.Material): void {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 20), mat);
  g.rotation.x = Math.PI / 2;
  g.position.set(x, y, z);
  k.group.add(g);
  for (const r of [0, Math.PI / 2]) {
    const s = k.box(0.4, 0.02, 0.012, metal(k), x, y, z + out * 0.006, false);
    s.rotation.z = r;
  }
}

/** 옥상 난간: 길 쪽 가장자리를 따라 기둥과 손잡이 두 줄 */
export function roofRail(k: MapKit, minX: number, maxX: number, faceZ: number, out: 1 | -1, height: number): void {
  const mat = metal(k);
  const z = faceZ - out * 0.12;
  const n = Math.max(2, Math.round((maxX - minX) / 1.4));
  for (let i = 0; i <= n; i++) k.box(0.04, 0.9, 0.04, mat, minX + 0.1 + ((maxX - minX - 0.2) * i) / n, height + 0.45, z, false);
  for (const y of [0.88, 0.45]) k.box(maxX - minX - 0.2, 0.035, 0.035, mat, (minX + maxX) / 2, height + y, z, false);
}

/** 처진 전선 (a → b), 가운데가 sag만큼 처진다 */
export function wire(k: MapKit, a: THREE.Vector3, b: THREE.Vector3, sag: number): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4, false), dark(k));
  k.group.add(m);
}

/** 전봇대 변압기 (원통 + 받침) */
export function transformer(k: MapKit, x: number, z: number, side: 1 | -1): void {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 14), metal(k));
  m.position.set(x, 6.1, z + side * 0.38);
  m.castShadow = true;
  k.group.add(m);
  k.box(0.08, 0.08, 0.4, metal(k), x, 5.85, z + side * 0.2);
}

/** 집합 우편함: 담에 붙은 금속 상자 + 칸 */
export function mailbox(k: MapKit, x: number, faceZ: number, out: 1 | -1): void {
  const slot = dark(k);
  const z = faceZ + out * 0.06;
  k.box(0.56, 0.42, 0.12, metal(k), x, 1.0, z);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) k.box(0.12, 0.012, 0.01, slot, x - 0.17 + c * 0.17, 1.08 - r * 0.17, z + out * 0.062, false);
}

/** 스티로폼 상자 텃밭 (담 밑): 흰 상자 + 흙 + 새싹. 충돌 있음 */
export function styroGarden(k: MapKit, x: number, z: number): void {
  k.box(0.62, 0.3, 0.42, light(k), x, 0.15, z);
  k.box(0.56, 0.02, 0.36, k.mat('#5b4636', 1), x, 0.29, z, false);
  const leaf = k.mat('#5f9a3e', 0.9);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + k.rng() * 0.04, 0), leaf);
    s.position.set(x - 0.2 + i * 0.13, 0.36, z + (k.rng() - 0.5) * 0.2);
    k.group.add(s);
  }
  k.solidRect(x - 0.31, x + 0.31, z - 0.21, z + 0.21, 0.3); // 상자 가장자리 위
}
