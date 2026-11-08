import * as THREE from 'three';
import { brickTexture, facadeTexture } from '../textures';
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

/** 담장: 대문 자리(gaps)는 비워 둔다 */
export function wall(k: MapKit, minX: number, maxX: number, f: Frontage, gaps: [number, number][] = []): void {
  const mat = k.mat('#b9b2a6');
  const cap = k.mat('#8f887c');
  const z = f.wallZ * f.side;
  const segs: [number, number][] = [];
  let cur = minX;
  for (const [g0, g1] of gaps) {
    if (g0 > cur) segs.push([cur, g0]);
    cur = g1;
  }
  if (cur < maxX) segs.push([cur, maxX]);
  for (const [a, c] of segs) {
    const w = c - a;
    const m = k.box(w, 1.3, 0.2, mat, (a + c) / 2, 0.65, z);
    k.box(w, 0.06, 0.26, cap, (a + c) / 2, 1.33, z);
    k.occluders.push(m);
    k.solidRect(a, c, z - 0.1, z + 0.1);
  }
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
  wall(k, minX, maxX, f, [[gate, gate + 1.4]]);
  // 대문 옆 집합 우편함 (담의 길 쪽 면)
  mailbox(k, gate + 1.4 + 0.4, (f.wallZ - 0.1) * f.side, -f.side as 1 | -1);
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
