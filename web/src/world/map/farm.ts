import * as THREE from 'three';
import { createRng, range } from '../../core/rng';
import type { Rect } from '../collision';
import { mergeStatic } from '../merge';
import { MapKit } from '../parts/kit';
import { feedingShelter } from '../parts/props';
import type { PropId, PropModels } from '../propModels';
import { grassTexture } from '../textures';
import { forestRing } from './meadow';
import type { Neighborhood } from './neighborhood';

/**
 * 농장 맵 (D-58 5단계, 2026-11-12). 사용자 선택: 마당 + 둘레 밭, 추천 모델 26종, 낮은 것만 올라선다.
 * 가운데 흙마당에 헛간·곡물 저장탑·공구 창고(북쪽), 농가(서쪽), 닭장(동쪽), 우물·물통·건초 더미·트랙터.
 * 남쪽은 울타리 너머 밭(밀·옥수수·해바라기·호박), 동쪽은 과수원(사과·자두)과 벌통, 농가 북쪽은 텃밭(딸기·토마토).
 * 배치·충돌은 코드로 정한다 (모델이 없어도 같은 맵, 보이는 것만 모델). 건물은 막힌 벽이고 지붕에는 오르지 못한다.
 */
export const FARM_BOUNDS: Rect = { minX: -24, maxX: 24, minZ: -18, maxZ: 18 };

const FENCE_Z = -8; // 마당과 남쪽 밭 사이 울타리
const GATE = { x0: -1.1, x1: 1.1 }; // 울타리 문 자리 (열려 있다)
const FOOD = { x: -10.2, z: 6 };
const SUNFLOWERS = { z: -10.5, x0: 2, x1: 10 };

type Item = { x: number; z: number; rotY: number; scale: number };
type Box = { w: number; h: number; d: number; color: string };

export function buildFarm(models: PropModels = {}): Neighborhood {
  const b = FARM_BOUNDS;
  const k = new MapKit(createRng(5050));
  k.models = models;
  ground(k, b);

  k.beginZone('farm');
  yard(k);
  buildings(k);
  yardProps(k);
  fields(k, b);
  kitchenGarden(k);
  orchard(k);

  for (const [x, z] of [[-2, 2], [3, -4.5], [-7, -1], [17, 9]] as const) k.interests.push({ kind: 'sunspot', x, z, r: 1 });

  k.group = k.zones[0].group;
  forestRing(k, b);

  const keep = new Set([...k.occluders, ...k.unmerged]);
  let mergedAway = 0;
  for (const z of k.zones) mergedAway += mergeStatic(z.group, keep);

  return {
    group: k.root,
    zones: k.zones,
    collision: { bounds: b, rects: k.rects, circles: k.circles },
    interests: k.interests,
    occluders: k.occluders,
    spawn: { x: -1, z: -3.5, heading: 0 },
    foodStation: FOOD,
    npcSpot: { x: 2.5, z: -5.5 },
    mergedAway,
  };
}

/** 바깥 풀밭과 농장 잔디 */
function ground(k: MapKit, b: Rect): void {
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), k.mat('#86985a'));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  k.group.add(outer);
  const w = b.maxX - b.minX + 12;
  const d = b.maxZ - b.minZ + 12;
  const grass = grassTexture();
  grass.repeat.set(w / 2, d / 2);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  g.rotation.x = -Math.PI / 2;
  g.position.set((b.minX + b.maxX) / 2, 0.001, (b.minZ + b.maxZ) / 2);
  g.receiveShadow = true;
  k.group.add(g);
}

/** 흙마당과 마당에서 문·과수원으로 가는 흙길 */
function yard(k: MapKit): void {
  const dirt = k.mat('#b59c76', 1);
  k.flat(20, 13.5, dirt, 0, 0.75);
  k.flat(2.2, 3, dirt, 0, -7.2); // 문으로
  k.flat(6, 2.2, dirt, 12.5, -1.5); // 과수원으로
}

/** 막힌 건물 하나: 모델(없으면 같은 크기의 상자), 충돌 사각형, 카메라 가림 */
function building(k: MapKit, id: PropId, x: number, z: number, rotY: number, w: number, d: number, box: Box): void {
  k.occluders.push(k.prop(id, x, z, rotY, box));
  k.solidRect(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
}

function buildings(k: MapKit): void {
  // 헛간: 마당 북쪽, 앞(모델 +z)이 마당(남쪽)을 본다
  building(k, 'redBarn', 0, 11.5, Math.PI, 6.6, 7.7, { w: 6.6, h: 7, d: 7.7, color: '#a8382f' });
  // 곡물 저장탑 (둥근 탑)
  k.occluders.push(k.prop('grainSilo', 7.2, 12, 0, { w: 3, h: 7.3, d: 3, color: '#b8b2a4' }));
  k.circles.push({ x: 7.2, z: 12, r: 1.55 });
  building(k, 'toolShed', -6.6, 10.6, Math.PI, 2, 2, { w: 2, h: 2.6, d: 2, color: '#8a5a3a' });
  // 농가: 마당 서쪽, 앞이 마당(동쪽)을 본다. 돌리면 가로·세로가 바뀐다 (6.6 × 5.5 → 5.5 × 6.6)
  building(k, 'farmhouse', -15, 2, Math.PI / 2, 5.5, 6.6, { w: 5.5, h: 6, d: 6.6, color: '#d8c3a0' });
  // 닭장: 마당 동쪽, 앞이 마당(서쪽)을 본다
  building(k, 'chickenCoop', 12, 3, -Math.PI / 2, 2.7, 2.7, { w: 2.7, h: 2, d: 2.7, color: '#c9a46a' });
  // 풍차 펌프: 과수원 북쪽 모퉁이
  k.prop('windpump', 20, 12.5, 0.3, { w: 1.6, h: 7.9, d: 1.6, color: '#8a6a48' });
  k.solidRect(19.2, 20.8, 11.7, 13.3);
}

/** 마당 소품: 우물, 물통(테두리에 오름), 건초 더미(두 층), 트랙터(뒷바퀴 덮개에 오름), 수레, 사료 자루, 먹이 쉼터 */
function yardProps(k: MapKit): void {
  k.prop('stoneWell', -4, -2.5, 0.4, { w: 0.95, h: 1.7, d: 0.9, color: '#9c968c' });
  k.circles.push({ x: -4, z: -2.5, r: 0.5 });

  k.prop('waterTrough', 4.5, 5.6, 0, { w: 1.6, h: 0.45, d: 0.6, color: '#8a6440' });
  k.solidRect(3.7, 5.3, 5.3, 5.9, 0.42);
  k.interests.push({ kind: 'pond', x: 4.5, z: 4.9, r: 1.1 });

  // 건초 더미: 헛간 앞 왼쪽에 두 개를 나란히, 그 위에 하나 (0.59m → 1.18m)
  const BALE: Box = { w: 1.22, h: 0.59, d: 0.6, color: '#d9b45c' };
  k.prop('hayBale', -5.21, 5.6, 0, BALE);
  k.prop('hayBale', -3.97, 5.6, 0, BALE);
  k.prop('hayBale', -4.59, 5.6, 0.08, BALE).position.y = 0.59;
  k.solidRect(-5.82, -3.36, 5.3, 5.9, 0.59);
  k.solidRect(-5.2, -3.98, 5.32, 5.88, 1.18);
  k.interests.push({ kind: 'bench', x: -4.59, z: 5.6, r: 1.3 });
  // 닭장 앞 건초 하나
  k.prop('hayBale', 9.2, -3, Math.PI / 2, BALE);
  k.solidRect(8.9, 9.5, -3.61, -2.39, 0.59);

  // 트랙터: 옆으로(앞이 +x) 세운다. 앞쪽 보닛(1.36m)은 막히고 뒤쪽(뒷바퀴 덮개·좌석 1.1m)에는 오른다
  const tx = 6.5;
  const tz = -2.5;
  k.prop('tractor', tx, tz, Math.PI / 2, { w: 2.83, h: 1.6, d: 1.71, color: '#c4492e' });
  k.solidRect(tx - 1.41, tx - 0.6, tz - 0.86, tz + 0.86, 1.1);
  k.solidRect(tx - 0.6, tx + 1.42, tz - 0.86, tz + 0.86);
  k.interests.push({ kind: 'car', x: tx, z: tz, r: 1.8 });

  k.prop('wheelbarrow', -7.5, -3.8, 0.7, { w: 0.55, h: 0.7, d: 1.3, color: '#8a6440' });
  k.circles.push({ x: -7.5, z: -3.8, r: 0.45 });
  // 닭장 앞에 붙여 둔다 (마당 → 과수원 길 z 0 근처를 막지 않게)
  for (const [x, z, rot] of [[10.3, 1.4, 0.3], [10.05, 0.85, 1.2], [10.75, 1.05, 2.1]] as const) {
    k.prop('feedSack', x, z, rot, { w: 0.5, h: 0.65, d: 0.4, color: '#c2a06e' });
    k.circles.push({ x, z, r: 0.24 });
  }
  feedingShelter(k, FOOD.x, FOOD.z);
}

/** 남쪽 밭: 울타리(가운데 문), 밀(허수아비)·옥수수·해바라기 줄·호박. 작물은 종류마다 한 번에 그린다. 충돌 없음 (사이로 걸어 다닌다) */
function fields(k: MapKit, b: Rect): void {
  // 울타리 (윗면 0.78m, 담처럼 위를 걷는다). 가운데 문 자리는 열어 두고 문짝은 열린 채로 옆에 둔다
  const SEG = 1.8;
  const pieces: Item[] = [];
  for (let x = b.minX + SEG / 2; x < b.maxX; x += SEG) {
    if (x + SEG / 2 > GATE.x0 && x - SEG / 2 < GATE.x1) continue;
    pieces.push({ x, z: FENCE_Z, rotY: 0, scale: 1 });
  }
  const fence = k.scatter('farmFence', pieces);
  if (fence) fence.castShadow = true;
  else {
    const wood = k.mat('#8a6440');
    for (const [x0, x1] of [[b.minX, GATE.x0], [GATE.x1, b.maxX]]) for (const y of [0.3, 0.65]) k.box(x1 - x0, 0.08, 0.06, wood, (x0 + x1) / 2, y, FENCE_Z);
  }
  const westEnd = pieces.filter((p) => p.x < 0).reduce((m, p) => Math.max(m, p.x), -Infinity) + SEG / 2;
  const eastEnd = pieces.filter((p) => p.x > 0).reduce((m, p) => Math.min(m, p.x), Infinity) - SEG / 2;
  k.solidRect(b.minX, westEnd, FENCE_Z - 0.1, FENCE_Z + 0.1, 0.78);
  k.solidRect(eastEnd, b.maxX, FENCE_Z - 0.1, FENCE_Z + 0.1, 0.78);
  k.prop('farmGate', eastEnd + 0.1, FENCE_Z + 0.9, Math.PI / 2, { w: 1.8, h: 1.1, d: 0.1, color: '#8a6440' });
  k.solidRect(eastEnd, eastEnd + 0.2, FENCE_Z + 0.1, FENCE_Z + 1.8);

  const soil = k.mat('#7a5a3e', 1);
  const grid = (id: PropId, x0: number, x1: number, z0: number, z1: number, step: number, s0: number, s1: number, rng: () => number): void => {
    k.flat(x1 - x0 + 0.6, z1 - z0 + 0.6, soil, (x0 + x1) / 2, (z0 + z1) / 2);
    const items: Item[] = [];
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      for (let z = z0; z <= z1 + 1e-6; z += step) items.push({ x: x + range(rng, -0.12, 0.12), z: z + range(rng, -0.12, 0.12), rotY: rng() * 6.28, scale: range(rng, s0, s1) });
    }
    k.scatter(id, items);
  };
  const rng = createRng(5151);
  grid('wheatCrop', -22, -11, -16.5, -10, 1.2, 0.9, 1.15, rng);
  grid('cornCrop', -8, -2.5, -16.5, -10.5, 1.0, 0.9, 1.1, rng);
  grid('pumpkinCrop', 2.5, 10, -16.5, -13, 1.2, 0.8, 1.3, rng);
  // 해바라기 한 줄 (꽃 관심 지점)
  const sun: Item[] = [];
  for (let x = SUNFLOWERS.x0; x <= SUNFLOWERS.x1; x += 0.8) sun.push({ x, z: SUNFLOWERS.z + range(rng, -0.15, 0.15), rotY: Math.PI + range(rng, -0.3, 0.3), scale: range(rng, 0.9, 1.15) });
  k.scatter('sunflower', sun);
  k.interests.push({ kind: 'flower', x: (SUNFLOWERS.x0 + SUNFLOWERS.x1) / 2, z: SUNFLOWERS.z, r: 1.4 });
  k.prop('scarecrow', -16.5, -13, 0.4, { w: 1.3, h: 1.9, d: 0.3, color: '#a0522d' });
  k.circles.push({ x: -16.5, z: -13, r: 0.15 });
  for (const [x, z] of [[-16, -12], [-5, -13], [6, -14.5]] as const) k.interests.push({ kind: 'grass', x, z, r: 1.2 });
}

/** 농가 북쪽 텃밭: 갈아 놓은 밭 판 위에 딸기·토마토 */
function kitchenGarden(k: MapKit): void {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) k.prop('tilledSoil', -20 + i * 1.05, 8.6 + j * 1.05, 0, { w: 1, h: 0.04, d: 1, color: '#6b4a32' });
  const rng = createRng(5252);
  const straw: Item[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) straw.push({ x: -20 + i * 1.05, z: 8.6 + j * 1.05, rotY: rng() * 6.28, scale: range(rng, 0.9, 1.2) });
  k.scatter('strawberryCrop', straw);
  const tom: Item[] = [];
  for (let i = 0; i < 6; i++) tom.push({ x: -20.2 + i * 0.75, z: 11.2, rotY: rng() * 6.28, scale: range(rng, 0.9, 1.1) });
  k.scatter('tomatoCrop', tom);
  k.interests.push({ kind: 'grass', x: -18.4, z: 9.6, r: 1.6 });
}

/** 동쪽 과수원: 사과·자두나무를 줄지어, 가장자리 열매 덤불(꽃 관심 지점), 벌통 */
function orchard(k: MapKit): void {
  const rng = createRng(5353);
  let n = 0;
  for (let x = 16; x <= 22.5; x += 3.2) {
    for (let z = -10; z <= 8; z += 3.6) {
      const id: PropId = n++ % 3 === 2 ? 'plumTree' : 'appleTree';
      k.prop(id, x + range(rng, -0.3, 0.3), z + range(rng, -0.3, 0.3), rng() * 6.28, { w: 0.6, h: 4.2, d: 0.6, color: '#5d8c42' });
      k.circles.push({ x, z, r: 0.25 });
      k.interests.push({ kind: 'grass', x, z, r: 1.2 });
    }
  }
  const bushes: Item[] = [];
  for (let z = -11; z <= 9; z += 2.2) bushes.push({ x: 14.4 + range(rng, -0.2, 0.2), z: z + range(rng, -0.3, 0.3), rotY: rng() * 6.28, scale: range(rng, 0.9, 1.2) });
  k.scatter('berryBush', bushes.filter((p) => Math.abs(p.z + 1.5) > 1.6)); // 과수원으로 가는 길은 비운다
  k.interests.push({ kind: 'flower', x: 14.4, z: 5, r: 1.5 });
  for (const [x, z] of [[22.6, -13.5], [21.6, -13.5]] as const) {
    k.prop('beehive', x, z, Math.PI, { w: 0.47, h: 0.9, d: 0.58, color: '#d9b45c' });
    k.circles.push({ x, z, r: 0.32 });
  }
}
