import * as THREE from 'three';
import { blockWallTexture, brickTexture, facadeTexture, wireMeshTexture } from '../textures';
import { facadeDetails, mailbox, roofRail } from './details';
import type { MapKit } from './kit';

/**
 * 건물 부품: 길(x축 방향)을 따라 늘어선 담장과 건물.
 * side: 길 북쪽(+1) / 남쪽(−1). wallZ: 길 가운데에서 담장 선까지 거리.
 */
export interface Frontage {
  side: 1 | -1;
  wallZ: number;
}

export type WallBody = 'cement' | 'block';
/** 담 윗부분: 평평한 덮개 / 기와 / 철망 (철망 담은 올라설 수 없다) */
export type WallCap = 'flat' | 'tile' | 'mesh';
export interface WallStyle {
  body: WallBody;
  cap: WallCap;
}

/** 담 윗면 (점프·담 위 걷기에 쓴다, docs/10-jump-plan.md J-0) */
export interface WallTop {
  minX: number;
  maxX: number;
  z: number;
  /** 윗면 높이 (m) */
  top: number;
  /** 윗면 폭 (m) */
  width: number;
  climbable: boolean;
}

const WALL_H = 1.3;

/**
 * 담장: 대문 자리(gaps)는 비워 둔다. style을 주지 않으면 무작위(블록 45%, 덮개: 평평 50%·기와 30%·철망 20%).
 * gate: 대문 기둥과 안쪽으로 열어 둔 철문을 붙인다 (지나가는 길은 막지 않음). 반환: 담 조각마다 윗면 정보
 */
export function wall(k: MapKit, minX: number, maxX: number, f: Frontage, gaps: [number, number][] = [], style?: WallStyle, gate = false): WallTop[] {
  const st: WallStyle = style ?? { body: k.rng() < 0.45 ? 'block' : 'cement', cap: pickCap(k.rng()) };
  const mat = st.body === 'block' ? blockMaterial() : k.mat('#b9b2a6');
  const z = f.wallZ * f.side;
  const segs: [number, number][] = [];
  let cur = minX;
  for (const [g0, g1] of gaps) {
    if (g0 > cur) segs.push([cur, g0]);
    cur = g1;
  }
  if (cur < maxX) segs.push([cur, maxX]);
  const tops: WallTop[] = [];
  for (const [a, c] of segs) {
    const w = c - a;
    const m = k.box(w, WALL_H, 0.2, mat, (a + c) / 2, WALL_H / 2, z);
    if (st.body === 'block') scaleUv(m.geometry, w / 0.8, WALL_H / 0.8);
    k.occluders.push(m);
    const t: WallTop = { minX: a, maxX: c, z, ...wallCap(k, st.cap, a, c, z) };
    k.solidRect(a, c, z - 0.1, z + 0.1, t.climbable ? t.top : undefined);
    tops.push(t);
  }
  if (gate) for (const [g0, g1] of gaps) gateParts(k, g0, g1, z, f.side);
  return tops;
}

function pickCap(r: number): WallCap {
  return r < 0.5 ? 'flat' : r < 0.8 ? 'tile' : 'mesh';
}

/** 담 윗부분을 만들고 윗면 높이·폭·올라설 수 있는지를 돌려준다 */
function wallCap(k: MapKit, cap: WallCap, a: number, c: number, z: number): { top: number; width: number; climbable: boolean } {
  const w = c - a;
  const x = (a + c) / 2;
  if (cap === 'tile') {
    // 기와: 처마처럼 넓은 아랫단 + 좁은 용마루
    const tile = k.mat('#4d5357', 0.7);
    k.box(w, 0.08, 0.34, tile, x, WALL_H + 0.04, z);
    k.box(w, 0.06, 0.16, tile, x, WALL_H + 0.11, z, false);
    return { top: WALL_H + 0.14, width: 0.34, climbable: true };
  }
  k.box(w, 0.06, 0.26, k.mat('#8f887c'), x, WALL_H + 0.03, z);
  if (cap === 'mesh') {
    // 철망: 기둥 + 위아래 가로대 + 마름모 철망 판 (위로 0.55m)
    const metal = k.mat('#6b7073', 0.5);
    const n = Math.max(1, Math.round(w / 1.2));
    for (let i = 0; i <= n; i++) k.box(0.035, 0.55, 0.035, metal, a + 0.05 + ((w - 0.1) * i) / n, WALL_H + 0.06 + 0.275, z, false);
    k.box(w - 0.1, 0.03, 0.03, metal, x, WALL_H + 0.6, z, false);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, 0.5), meshMaterial());
    scaleUv(net.geometry, (w - 0.1) / 0.25, 0.5 / 0.25);
    net.position.set(x, WALL_H + 0.06 + 0.27, z);
    k.group.add(net);
  }
  return { top: WALL_H + 0.06, width: 0.26, climbable: cap !== 'mesh' };
}

/** 대문: 양쪽 기둥(담보다 조금 높게) + 안쪽 담에 붙여 열어 둔 철문 */
function gateParts(k: MapKit, g0: number, g1: number, z: number, side: 1 | -1): void {
  const pillar = k.mat('#a39c90');
  for (const x of [g0 - 0.15, g1 + 0.15]) k.box(0.3, 1.6, 0.3, pillar, x, 0.8, z);
  const leaf = k.mat('#4a5a52', 0.55);
  const lw = g1 - g0 - 0.1;
  // 안쪽(건물 쪽)으로 열려 담 안쪽 면에 붙은 철문
  k.box(lw, 1.15, 0.03, leaf, g1 + 0.3 + lw / 2, 0.68, z + side * 0.14, false);
  for (let i = 1; i < 6; i++) k.box(0.025, 1.0, 0.035, k.mat('#2f3a35', 0.55), g1 + 0.3 + (lw * i) / 6, 0.68, z + side * 0.16, false);
}

/** 상자 도형의 텍스처 좌표를 늘린다 (같은 텍스처를 길이가 다른 담에 같은 크기로) */
function scaleUv(g: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

let blockMat: THREE.MeshStandardMaterial | null = null;
function blockMaterial(): THREE.MeshStandardMaterial {
  blockMat ??= new THREE.MeshStandardMaterial({ map: blockWallTexture(), roughness: 0.95 });
  return blockMat;
}

let netMat: THREE.MeshStandardMaterial | null = null;
function meshMaterial(): THREE.MeshStandardMaterial {
  netMat ??= new THREE.MeshStandardMaterial({ map: wireMeshTexture(), transparent: true, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false });
  netMat.userData.mergeable = true;
  return netMat;
}

/** 외벽 텍스처 한 장의 크기 (창 위치 계산용)와 디테일 선택 */
export interface FacadeLayout {
  tileW: number;
  tileH: number;
  /** 벽돌: 텍스처에 창이 없어 창을 입체로 붙인다 */
  glass?: boolean;
  /** 옥상 난간 */
  rail?: boolean;
}

/** 담장 안쪽에 앉은 건물 덩어리 + 옥상 방수 페인트 (+ 외벽 디테일) */
export function building(k: MapKit, minX: number, maxX: number, f: Frontage, height: number, depth: number, mat: THREE.Material, layout?: FacadeLayout): void {
  const front = (f.wallZ + 0.6) * f.side;
  const back = front + depth * f.side;
  const z0 = Math.min(front, back);
  const z1 = Math.max(front, back);
  const m = k.box(maxX - minX, height, z1 - z0, mat, (minX + maxX) / 2, height / 2, (z0 + z1) / 2);
  k.occluders.push(m);
  k.solidRect(minX, maxX, z0, z1);
  // 옥상 방수 페인트 (초록) — 한국 주택 옥상의 흔한 모습
  k.box(maxX - minX - 0.2, 0.05, z1 - z0 - 0.2, k.mat('#5f8f6a'), (minX + maxX) / 2, height + 0.03, (z0 + z1) / 2, false);
  if (layout) {
    const out = -f.side as 1 | -1; // 길 쪽 면이 바라보는 방향
    facadeDetails(k, { minX, maxX, faceZ: front, out, height, tileW: layout.tileW, tileH: layout.tileH, glass: layout.glass });
    if (layout.rail) roofRail(k, minX, maxX, front, out, height);
  }
}

/** 빌라: 벽돌 또는 색 외벽, 담장에 대문 하나 */
export function villa(k: MapKit, minX: number, maxX: number, f: Frontage, height: number, color: string): void {
  const tex = color === 'brick' ? brickTexture() : facadeTexture(color);
  const w = maxX - minX;
  tex.repeat.set(w / 3, height / 3);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const bw = w - 0.6;
  building(k, minX + 0.3, maxX - 0.3, f, height, 8, mat, { tileW: bw / (w / 3), tileH: 3, glass: color === 'brick', rail: true });
  const gate = minX + w * 0.35;
  wall(k, minX, maxX, f, [[gate, gate + 1.4]], undefined, true);
  // 대문 옆 집합 우편함 (담의 길 쪽 면)
  mailbox(k, gate + 1.4 + 0.75, (f.wallZ - 0.1) * f.side, -f.side as 1 | -1); // 대문 기둥(폭 0.3) 옆
}

/** 단독주택 */
export function house(k: MapKit, minX: number, maxX: number, f: Frontage, height: number, color: string): void {
  const tex = facadeTexture(color, '#f4f0e6');
  tex.repeat.set((maxX - minX) / 3.2, 1.3);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const bw = maxX - minX - 1.2;
  building(k, minX + 0.6, maxX - 0.6, f, height, 7, mat, { tileW: bw / ((maxX - minX) / 3.2), tileH: height / 1.3 });
  wall(k, minX, maxX, f, []);
}

/** 길가 가게 (담장 없이 길에 붙음) + 줄무늬 차양 */
export function shop(k: MapKit, minX: number, maxX: number, f: Frontage): void {
  const tex = facadeTexture('#f0ece2', '#ffffff');
  tex.repeat.set((maxX - minX) / 3, 1.2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  const front = (f.wallZ - 0.2) * f.side;
  const depth = 6;
  const z0 = Math.min(front, front + depth * f.side);
  const z1 = Math.max(front, front + depth * f.side);
  const m = k.box(maxX - minX, 3.6, z1 - z0, mat, (minX + maxX) / 2, 1.8, (z0 + z1) / 2);
  k.occluders.push(m);
  k.solidRect(minX, maxX, z0, z1);
  facadeDetails(k, { minX, maxX, faceZ: front, out: -f.side as 1 | -1, height: 3.6, tileW: 3, tileH: 3, ac: false });
  const awning = k.box(maxX - minX - 0.4, 0.08, 1.0, k.mat('#3d7a5a'), (minX + maxX) / 2, 2.6, front - 0.45 * f.side);
  awning.rotation.x = 0.25 * f.side;
}

/** 멀리 보이는 아파트 (이동 불가, 풍경용) */
export function backdropApartments(k: MapKit): void {
  const tex = facadeTexture('#e4e1da', '#f6f4ef');
  for (const [x, z, h, w] of [[38, -18, 42, 14], [40, 6, 48, 14], [36, 28, 39, 12], [-45, 24, 45, 14], [-40, -26, 42, 16], [10, 38, 36, 14], [-14, -36, 40, 14]] as const) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 3, h / 3);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    m.position.set(x, h / 2, z);
    m.lookAt(0, h / 2, 0);
    k.group.add(m);
  }
}
