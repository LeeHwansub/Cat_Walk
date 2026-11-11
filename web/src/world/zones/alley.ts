import * as THREE from 'three';
import { range } from '../../core/rng';
import type { Rect } from '../collision';
import { house, shop, villa, type Frontage } from '../parts/buildings';
import type { MapKit } from '../parts/kit';
import { groundAcUnit, styroGarden, transformer, wire } from '../parts/details';
import { car, feedingShelter, pole, pot, weeds } from '../parts/props';
import { exteriorStairs } from '../parts/stairs';
import { asphaltTexture } from '../textures';

/**
 * 골목 구역 (서쪽, x −26 ~ 5): 한국 주택가 골목. 큰길은 x축 방향.
 * D-06·D-10의 MVP 맵에서 골목 부분을 그대로 옮겼다 (3-0, 모양 변화 없음).
 */
export const ALLEY_BOUNDS: Rect = { minX: -26, maxX: 5, minZ: -14, maxZ: 14 };
export const ROAD_HALF = 2.5;
export const WALL_Z = 3.3;
const NORTH: Frontage = { side: 1, wallZ: WALL_Z };
const SOUTH: Frontage = { side: -1, wallZ: WALL_Z };

export interface AlleyResult {
  foodStation: { x: number; z: number };
}

export function buildAlley(k: MapKit, bounds: Rect): AlleyResult {
  k.beginZone('alley');
  ground(k);
  roadMarkings(k);

  // ---- 북쪽 줄 (z +)
  villa(k, -25, -18.5, NORTH, 9.5, 'brick');
  sideAlley(k, -18.5, -15.5, bounds);
  house(k, -15.5, -8.5, NORTH, 4.6, '#e8dcc0');
  villa(k, -8.5, -1.5, NORTH, 10.5, '#dcd8d0');
  shop(k, -1.5, 3.6, NORTH);

  // ---- 남쪽 줄 (z −)
  house(k, -25, -19, SOUTH, 4.2, '#d9cdb5');
  villa(k, -19, -12, SOUTH, 9, '#e3d3b5');
  parkingLot(k, -12, -6, bounds);
  villa(k, -6, 1, SOUTH, 10.5, 'brick');
  emptyLot(k, 1, 4.6);

  // ---- 골목 소품
  // 차: 소품 모델이 있으면 경차 밴·해치백 (2026-11-09 시범)
  for (const [x, z, color, model] of [[-21, 1.75, '#f2f2f2', 'keiVan'], [-9.5, -1.75, '#39465c', 'hatchback'], [-3, 1.75, '#b8bcc2', 'hatchback']] as const) car(k, x, z, color, 0, model);
  for (const x of [-22, -12.5, -2.5]) pole(k, x, 2.75);
  for (const x of [-16.5, -7]) pole(k, x, -2.75);
  for (const [x, z] of [[-24, 2.95], [-20.4, 2.95], [-13, 2.95], [-11.9, 2.95], [-6, 2.95], [-17.5, -2.95], [-14, -2.95], [-3, -2.95], [-0.5, -2.95]] as const) pot(k, x, z);
  for (const [x, z] of [[-10, 2.85], [-23, -2.9], [-1.5, -2.9]] as const) weeds(k, x, z);
  utilityLines(k);
  styroGarden(k, -7.6, 2.95);
  styroGarden(k, -15.5, -2.95);
  streetProps(k);
  return { foodStation: { x: 3.0, z: 2.75 } };
}

/**
 * 골목 생활 소품 (Polyfork 모델 시범, 2026-11-09): 자판기·음료 상자(가게 앞), 계량기 함, 자전거, 쓰레기통,
 * 주차장 입구 고깔, 가로등. 모델이 없으면 같은 크기의 상자. 충돌은 모델과 같은 크기로
 */
function streetProps(k: MapKit): void {
  // 가게 앞 자판기 (앞이 큰길 쪽) + 음료 상자 (올라설 수 있음)
  k.occluders.push(k.prop('vending', -0.3, 2.86, Math.PI, { w: 1.05, h: 1.8, d: 0.76, color: '#c4402f' })); // 키가 커서 카메라도 막는다
  k.solidRect(-0.83, 0.23, 2.48, 3.24);
  k.prop('crate', 0.7, 3.0, 0.2, { w: 0.44, h: 0.36, d: 0.41, color: '#3f5a8a' });
  k.solidRect(0.48, 0.92, 2.79, 3.21, 0.36);
  // 빌라 벽 앞 계량기 함
  k.prop('meterBox', -14.6, 3.1, Math.PI, { w: 0.46, h: 0.6, d: 0.29, color: '#d9d4c7' });
  k.solidRect(-14.83, -14.37, 2.95, 3.25, 0.6);
  // 남쪽 주택 담 앞 자전거 (길이 방향이 큰길과 나란히)
  k.prop('bicycle', -21.5, -2.92, Math.PI / 2, { w: 0.64, h: 1.0, d: 1.69, color: '#5a6b85' });
  k.solidRect(-22.35, -20.65, -3.24, -2.6);
  // 쓰레기통 (냄새 맡는 곳)
  k.prop('bin', -9.0, -2.95, 0, { w: 0.53, h: 0.8, d: 0.52, color: '#d8d6d0' });
  k.circles.push({ x: -9.0, z: -2.95, r: 0.27 });
  k.interests.push({ kind: 'pot', x: -9.0, z: -2.6, r: 0.6 });
  // 주차장 입구 고깔
  for (const x of [-11.6, -6.4]) {
    k.prop('cone', x, -3.0, 0, { w: 0.33, h: 0.52, d: 0.33, color: '#e8742c' });
    k.circles.push({ x, z: -3.0, r: 0.16 });
  }
  // 가로등 (팔이 큰길 쪽으로)
  for (const [x, z, rotY] of [[-15.0, 2.95, Math.PI], [-19.5, -2.95, 0]] as const) {
    k.prop('lamp', x, z, rotY, { w: 0.2, h: 4.5, d: 0.2, color: '#8a8f94' });
    k.circles.push({ x, z, r: 0.15 });
  }
}

/** 전선: 같은 쪽 전봇대끼리, 길 건너 지그재그, 건물로 들어가는 인입선. 변압기 하나 (3-1) */
function utilityLines(k: MapKit): void {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const north = [-22, -12.5, -2.5];
  const south = [-16.5, -7];
  for (const y of [7.3, 7.0]) {
    for (let i = 0; i + 1 < north.length; i++) wire(k, V(north[i], y, 2.75), V(north[i + 1], y, 2.75), 0.35);
    wire(k, V(south[0], y, -2.75), V(south[1], y, -2.75), 0.3);
  }
  wire(k, V(-12.5, 7.3, 2.75), V(-16.5, 7.3, -2.75), 0.3);
  wire(k, V(-2.5, 7.3, 2.75), V(-7, 7.3, -2.75), 0.3);
  // 인입선: 전봇대에서 건물 외벽으로
  wire(k, V(-12.5, 6.8, 2.75), V(-9.5, 6.0, 3.9), 0.15);
  wire(k, V(-7, 6.8, -2.75), V(-4.5, 6.2, -3.9), 0.15);
  transformer(k, -12.5, 2.75, 1);
}

/** 먹이 쉼터 (공원 다음에 만든다: 원래 배치 순서 유지) */
export function buildFeedingCorner(k: MapKit, at: { x: number; z: number }): void {
  k.group = k.zones.find((z) => z.id === 'alley')!.group;
  feedingShelter(k, at.x, at.z);
}

function ground(k: MapKit): void {
  const asphalt = asphaltTexture();
  asphalt.repeat.set(50 / 3, 28 / 3);
  const a = new THREE.Mesh(new THREE.PlaneGeometry(31, 28), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }));
  a.rotation.x = -Math.PI / 2;
  a.position.set(-26 + 15.5, 0, 0);
  a.receiveShadow = true;
  k.group.add(a);
}

function roadMarkings(k: MapKit): void {
  const white = k.mat('#e9e6dc', 0.7);
  for (const z of [-ROAD_HALF + 0.15, ROAD_HALF - 0.15]) k.flat(30, 0.1, white, -26 + 15, z);
  // 횡단보도 (참조 영상에서 본 생활 도로의 흰 줄무늬)
  for (let z = -2.0; z <= 2.0; z += 0.8) k.flat(0.45, 2.6, white, -17, z, Math.PI / 2);
  // 정지선
  k.flat(0.25, ROAD_HALF * 2 - 0.4, white, -18.8, 0, Math.PI / 2);
}

/** 좁은 옆 골목: 양옆은 이웃 건물 벽, 끝에는 담장. 안쪽에 평상과 화분 */
function sideAlley(k: MapKit, minX: number, maxX: number, b: Rect): void {
  const mid = (minX + maxX) / 2;
  k.occluders.push(k.box(maxX - minX, 1.6, 0.2, k.mat('#b9b2a6'), mid, 0.8, b.maxZ - 0.1));
  // 서쪽 벽(벽돌 빌라 옆면)에 붙은 외부 계단: 큰길 쪽에서 북쪽으로 올라 2층 현관 앞(3.0m)까지 (J-4)
  exteriorStairs(k, { wallX: minX, width: 0.9, z0: 4.0, height: 3.0, steps: 18, tread: 0.26, landing: 1.32 });
  // 평상은 현관 뒤(북쪽)로: 계단 옆 걷는 길(약 2.1m)과 평상 양옆 틈(0.6m)을 남긴다
  const deckZ = 12.3;
  const deck = k.box(1.8, 0.38, 1.3, k.mat('#a0784e'), mid, 0.19, deckZ);
  k.occluders.push(deck);
  k.solidRect(mid - 0.9, mid + 0.9, deckZ - 0.65, deckZ + 0.65, 0.38); // 평상 윗면
  k.interests.push({ kind: 'sunspot', x: mid, z: deckZ - 1.1, r: 0.8 }, { kind: 'bench', x: mid, z: deckZ - 1.0, r: 0.8 });
  pot(k, maxX - 0.4, 5.0); // 계단 자리에 있던 화분 (원래 minX + 0.4, 6.5)
  pot(k, maxX - 0.4, 8.2);
  weeds(k, maxX - 0.35, 12.5);
  // 높은 벽·담장은 카메라도 막는다 (빠지면 카메라가 벽을 뚫고 들어가 벽 속이 보인다)
  k.occluders.push(
    k.box(0.3, 8, b.maxZ - WALL_Z, k.mat('#cfc8bb'), minX - 0.15, 4, (b.maxZ + WALL_Z) / 2),
    k.box(0.3, 4.5, b.maxZ - WALL_Z, k.mat('#d8cfba'), maxX + 0.15, 2.25, (b.maxZ + WALL_Z) / 2),
  );
  k.solidRect(minX - 0.3, minX, WALL_Z, b.maxZ);
  k.solidRect(maxX, maxX + 0.3, WALL_Z, b.maxZ);
}

/** 열린 주차 공간 (차 2대) */
function parkingLot(k: MapKit, minX: number, maxX: number, b: Rect): void {
  const white = k.mat('#e9e6dc', 0.7);
  for (let x = minX + 0.2; x <= maxX; x += 2.6) k.flat(0.1, 5, white, x, -8.5);
  car(k, minX + 1.5, -8.5, '#c9c9c9', Math.PI / 2, 'keiVan');
  car(k, minX + 4.1, -8.6, '#7a2d2d', Math.PI / 2, 'hatchback');
  // 배달 오토바이: 주차 칸 옆, 담 앞 (시범)
  k.occluders.push(k.prop('moped', maxX - 0.6, -9.8, 0, { w: 0.66, h: 1.3, d: 1.8, color: '#3d7a4a' }));
  k.solidRect(maxX - 0.95, maxX - 0.25, -10.7, -8.9);
  groundAcUnit(k, maxX - 0.6, -4.6, 1);
  k.box(maxX - minX, 1.5, 0.2, k.mat('#b9b2a6'), (minX + maxX) / 2, 0.75, b.minZ + 0.1);
  k.interests.push({ kind: 'sunspot', x: maxX - 1, z: -5, r: 0.8 });
  weeds(k, maxX - 0.4, -11.5);
  for (const x of [minX, maxX]) {
    k.occluders.push(k.box(0.2, 1.4, Math.abs(b.minZ) - WALL_Z, k.mat('#b9b2a6'), x, 0.7, (b.minZ - WALL_Z) / 2));
    k.solidRect(x - 0.1, x + 0.1, b.minZ, -WALL_Z, 1.4); // 주차장 옆 담
  }
}

/** 풀이 자란 작은 공터 */
function emptyLot(k: MapKit, minX: number, maxX: number): void {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX - 0.4, 5), new THREE.MeshStandardMaterial({ color: '#7d9a55', roughness: 1 }));
  g.rotation.x = -Math.PI / 2;
  g.position.set((minX + maxX) / 2, 0.003, -5.8);
  g.receiveShadow = true;
  k.group.add(g);
  for (let i = 0; i < 6; i++) weeds(k, range(k.rng, minX + 0.5, maxX - 0.5), range(k.rng, -8, -3.8));
  k.occluders.push(k.box(maxX - minX, 1.3, 0.2, k.mat('#b9b2a6'), (minX + maxX) / 2, 0.65, -8.5));
  groundAcUnit(k, maxX - 0.7, -8.1, 1);
  k.solidRect(minX, maxX, -8.6, -8.4, 1.3); // 공터 뒤 담
}
