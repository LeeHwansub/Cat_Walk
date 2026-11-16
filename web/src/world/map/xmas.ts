import * as THREE from 'three';
import { createRng, range } from '../../core/rng';
import type { Rect } from '../collision';
import { mergeStatic } from '../merge';
import { MapKit } from '../parts/kit';
import { bench, feedingShelter } from '../parts/props';
import type { Lighting, TimeOfDay } from '../lighting';
import type { PropId, PropModels } from '../propModels';
import type { Neighborhood } from './neighborhood';

/**
 * 크리스마스 맵 "눈 오는 광장" (2026-11-16). 설계: Cowork "Cat Walk 보드" X-01~X-06 (평면도 X-03의 좌표 그대로).
 * 가운데 돌바닥 광장(반지름 6.2)에 큰 트리(줄기만 막힘)와 선물 상자 계단, 북쪽 마켓 거리(가판대 5개·가로등 줄·전구 줄),
 * 서쪽 오두막 2채와 화로·그루터기 의자·장작 더미, 동쪽 얼음 연못·눈사람·눈 덮인 벤치·썰매, 남쪽 지팡이 사탕 입구.
 * 기본 시간대는 저녁 (조명은 XMAS_LIGHTING). 소품은 직접 만든 18종 (tools/blender/xmas_props.py) + 눈 얹은 소나무·벤치·그루터기.
 * 배치·충돌은 코드로 정한다 (모델이 없어도 같은 맵).
 * 좌우: 보드 평면도는 북(+z)을 위로, 서쪽을 왼쪽에 그렸는데, 이 게임 좌표에서 북쪽을 보면 −x가 오른쪽이다.
 * 콘셉트 그림(입구에서 볼 때 오두막이 왼쪽)과 같아 보이도록 평면도의 x를 뒤집어 놓는다 (오두막 x +15.5, 얼음 연못 x −13)
 */
/** 시간대별 조명 (보드 X-02 값 그대로). 기본은 저녁 */
export const XMAS_LIGHTING: Record<TimeOfDay, Lighting> = {
  day: {
    sky: ['#8fbbe8', '#eef3f8'],
    hemi: ['#e2eef7', '#b9c4d6', 1.25],
    sun: { color: '#fff0d8', intensity: 2.4, offset: [9, 15, 6] },
    fog: { color: '#e3ecf5', near: 26, far: 78 },
    exposure: 1.0,
    glow: 0.5,
    lamps: 0,
    fill: 0,
  },
  dusk: {
    sky: ['#27356b', '#6a5a93', '#f0a070'],
    hemi: ['#93a5e0', '#5b5578', 0.85],
    sun: { color: '#ffa56b', intensity: 1.25, offset: [-15, 5, 3] }, // 서쪽 낮게
    fog: { color: '#8f86a8', near: 26, far: 78 },
    exposure: 1.0,
    glow: 1,
    lamps: 1,
    fill: 0.25,
  },
  night: {
    sky: ['#070b22', '#27305c'],
    hemi: ['#5b72c4', '#20244a', 0.42],
    sun: { color: '#9fb4ff', intensity: 0.45, offset: [-6, 14, -8] }, // 달
    fog: { color: '#1a2248', near: 26, far: 78 },
    exposure: 1.0,
    glow: 1.25,
    lamps: 1.5,
    fill: 0.6,
  },
};

export const XMAS_BOUNDS: Rect = { minX: -20, maxX: 20, minZ: -16, maxZ: 16 };

const PLAZA_R = 6.2;
const FIRE = { x: 9.3, z: -0.8 };
const FOOD = { x: -4.2, z: 9.3 };
const POND = { x: -13, z: -3, r: 4.2 };
const STALL_Z = 11.2;
const LAMP_Z = 7.9;
const ROW_LAMPS_X = [-11.5, -6.9, -2.3, 2.3, 6.9, 11.5];
const CABINS: [number, number][] = [[15.5, 4], [15.5, -5.5]];

export function buildXmas(models: PropModels = {}): Neighborhood {
  const b = XMAS_BOUNDS;
  const k = new MapKit(createRng(6060));
  k.models = models;
  ground(k);

  k.beginZone('plaza');
  plaza(k);
  market(k);
  cabins(k);
  firePlace(k);
  iceSide(k);
  entrance(k);
  innerPines(k);
  snowPiles(k);

  k.group = k.zones[0].group;
  pineRing(k, b);
  const snow = snowfall();
  k.group.add(snow.points);

  const keep = new Set([...k.occluders, ...k.unmerged, snow.points]);
  let mergedAway = 0;
  for (const z of k.zones) mergedAway += mergeStatic(z.group, keep);

  return {
    group: k.root,
    zones: k.zones,
    collision: { bounds: b, rects: k.rects, circles: k.circles },
    interests: k.interests,
    occluders: k.occluders,
    spawn: { x: 0, z: -10, heading: 0 },
    foodStation: FOOD,
    npcSpot: { x: -2.9, z: 9.4 },
    mergedAway,
    lights: k.lights,
    update: snow.update,
  };
}

/** 회전한 소품의 바닥 사각형을 축에 맞춘 사각형으로 (충돌용) */
function footprint(k: MapKit, x: number, z: number, w: number, d: number, rotY: number, top?: number): void {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  k.solidRect(x - hw, x + hw, z - hd, z + hd, top);
}

/** 바닥에 붙인 판 (돌바닥 길, 마켓 거리) */
function slab(k: MapKit, w: number, d: number, color: string, x: number, z: number, y = 0.004): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), k.mat(color, 1));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  k.group.add(m);
}

/** 눈 덮인 땅과 지평선까지 이어지는 바깥 눈밭 */
function ground(k: MapKit): void {
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), k.mat('#eef2f9', 1));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  k.group.add(outer);
}

/** 가운데 광장: 돌바닥과 네 방향 길, 큰 트리(줄기만 막힘), 선물 상자 계단과 장식 상자, 빈 상자·털실 공, 광장 둘레 가로등 4개 */
function plaza(k: MapKit): void {
  const stone = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 48), k.mat('#c4bcb2', 1));
  stone.rotation.x = -Math.PI / 2;
  stone.position.y = 0.006;
  stone.receiveShadow = true;
  k.group.add(stone);
  const path = '#d3d0cc';
  slab(k, 2.4, 7, path, 0, -9.5); // 남쪽 입구 길
  slab(k, 2.4, 2.4, path, 0, 6.6); // 북쪽 마켓 거리로
  slab(k, 26, 3.4, '#d6d4d0', 0, 8.7); // 마켓 거리
  slab(k, 3, 2, path, -7.4, -3); // 동쪽 얼음 연못으로
  slab(k, 2.4, 2, path, 7.2, -0.8); // 서쪽 화로로

  k.occluders.push(k.prop('xmasTreeLarge', 0, 0, 0.3, { w: 4.2, h: 6.5, d: 4.2, color: '#2f6b3a' }));
  k.circles.push({ x: 0, z: 0, r: 0.35 }); // 줄기만: 가지 밑으로 지나간다
  k.interests.push({ kind: 'pot', x: 0, z: -1.6, r: 1.2 }); // 방울 냄새 맡기
  k.lights.push({ x: 0, y: 6.5, z: 0, color: '#fff3c4', light: false }); // 꼭대기 별

  // 선물 상자: 계단(소 → 중 → 대)과 장식. [id, x, z, 폭, 윗면, 돌림]
  const gifts: [PropId, number, number, number, number, number][] = [
    ['giftS', -1.2, -2.8, 0.33, 0.3, -0.2],
    ['giftM', -1.85, -2.35, 0.53, 0.5, 0.3],
    ['giftL', -2.5, -1.9, 0.83, 0.8, -0.4],
    ['giftM', 1.1, 2.7, 0.53, 0.5, -0.6],
    ['giftS', -1.25, 2.35, 0.33, 0.3, 0.5],
    ['giftL', -2.1, 1.75, 0.83, 0.8, -0.9],
  ];
  for (const [id, x, z, w, top, rot] of gifts) {
    k.prop(id, x, z, rot, { w, h: top, d: w, color: '#b33a3a' });
    footprint(k, x, z, w * 0.9, w * 0.9, rot, top);
  }
  k.interests.push({ kind: 'bench', x: -2.5, z: -1.9, r: 0.9 }); // 대 상자 위: 광장을 내려다보는 자리
  // 빈 상자(들어가 앉는 자리, 충돌 없음)와 털실 공
  k.prop('giftOpen', 2.6, -1.9, -0.5, { w: 0.62, h: 0.4, d: 0.62, color: '#b33a3a' });
  k.interests.push({ kind: 'bench', x: 2.6, z: -1.9, r: 0.6 });
  k.prop('yarnBall', 3.6, -3.1, -0.6, { w: 0.22, h: 0.22, d: 0.22, color: '#c0392b' });

  for (const [x, z] of [[-7, 6], [7, 6], [-7, -6], [7, -6]] as const) lamp(k, x, z, false);
  for (const [x, z] of [[-4.2, -4.2], [4.4, 4]] as const) k.interests.push({ kind: 'sunspot', x, z, r: 1 });
}

/** 리본 가로등 하나 (등 높이 2.8m). light: 실제 점조명 후보 */
function lamp(k: MapKit, x: number, z: number, light: boolean): void {
  k.prop('ribbonLamp', x, z, Math.atan2(-x, -z), { w: 0.2, h: 3.2, d: 0.2, color: '#222' });
  k.circles.push({ x, z, r: 0.13 });
  k.lights.push({ x, y: 2.85, z, color: '#ffd27a', light });
}

/**
 * 북쪽 마켓 거리: 가판대 5개(남쪽을 봄, 진열대 0.86m에 올라섬), 가로등 6개와 그 사이 전구 줄, 먹이 쉼터.
 * 가판대 앞(남쪽) 0.5m가 진열대, 나머지는 막힌다
 */
function market(k: MapKit): void {
  for (const x of [-9, -4.5, 0, 4.5, 9]) {
    k.occluders.push(k.prop('marketStall', x, STALL_Z, Math.PI, { w: 2.5, h: 2.5, d: 1.66, color: '#8a5a3a' }));
    k.solidRect(x - 1.25, x + 1.25, STALL_Z - 0.33, STALL_Z + 0.83);
    k.solidRect(x - 1.15, x + 1.15, STALL_Z - 0.83, STALL_Z - 0.33, 0.86);
    k.interests.push({ kind: 'bench', x, z: STALL_Z - 0.58, r: 0.8 });
  }
  ROW_LAMPS_X.forEach((x, i) => lamp(k, x, LAMP_Z, i > 0 && i < ROW_LAMPS_X.length - 1));
  bulbStrings(k);
  feedingShelter(k, FOOD.x, FOOD.z);
  k.prop('xmasTreeSmall', -11.8, 10.6, 0.4, { w: 0.8, h: 1.45, d: 0.8, color: '#2f6b3a' });
  k.circles.push({ x: -11.8, z: 10.6, r: 0.36 });
  k.prop('xmasTreeSmall', 11.8, 10.6, 1.4, { w: 0.8, h: 1.45, d: 0.8, color: '#2f6b3a' });
  k.circles.push({ x: 11.8, z: 10.6, r: 0.36 });
}

/** 가로등 사이 전구 줄: 처지게 이은 작은 전구 (빛나는 재질, 한 번에 그린다) */
function bulbStrings(k: MapKit): void {
  const colors = ['#fff1c9', '#ffd27a', '#ff8a6b', '#9fd3ff', '#fff1c9', '#b9f2a6'];
  const spots: [number, number, number][] = [];
  for (let i = 0; i + 1 < ROW_LAMPS_X.length; i++) {
    const x0 = ROW_LAMPS_X[i];
    const x1 = ROW_LAMPS_X[i + 1];
    for (let j = 1; j < 20; j++) {
      const t = j / 20;
      spots.push([x0 + (x1 - x0) * t, 2.75 - Math.sin(t * Math.PI) * 0.45, LAMP_Z]);
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ name: 'glow', toneMapped: false }), spots.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  spots.forEach(([x, y, z], i) => {
    inst.setMatrixAt(i, m.makeTranslation(x, y, z));
    inst.setColorAt(i, c.set(colors[i % colors.length]));
  });
  inst.castShadow = false;
  inst.name = 'bulbStrings';
  k.group.add(inst);
  k.unmerged.push(inst);
}

/** 서쪽 오두막 2채 (동쪽을 봄, 창문 불빛), 우체통 */
function cabins(k: MapKit): void {
  for (const [x, z] of CABINS) {
    k.occluders.push(k.prop('logCabin', x, z, -Math.PI / 2, { w: 5.4, h: 4.6, d: 4.4, color: '#7a5636' }));
    footprint(k, x, z, 5.3, 4.3, Math.PI / 2);
    k.lights.push({ x: x - 2.4, y: 1.3, z, color: '#ffb35c' }); // 창문 불빛 (광장 쪽)
  }
  k.prop('santaMailbox', 11.6, 6.6, Math.PI / 2, { w: 0.43, h: 1.37, d: 0.59, color: '#b33a3a' });
  k.circles.push({ x: 11.6, z: 6.6, r: 0.22 });
}

/** 화로(가운데만 막힘), 따뜻한 자리, 그루터기 의자 3개(0.36m, 눈 얹음), 장작 더미(0.65m) */
function firePlace(k: MapKit): void {
  k.prop('firePit', FIRE.x, FIRE.z, 0, { w: 1.3, h: 0.5, d: 1.3, color: '#6b6b6b' });
  k.circles.push({ x: FIRE.x, z: FIRE.z, r: 0.6 });
  k.lights.unshift({ x: FIRE.x, y: 0.6, z: FIRE.z, color: '#ff9a3c', halo: 1.8 }); // 첫째 불빛 (점조명)
  k.interests.push({ kind: 'sunspot', x: FIRE.x - 1.9, z: FIRE.z, r: 1.2 }); // 따뜻한 자리 (광장 쪽)
  k.snowy = true;
  for (const a of [Math.PI * 0.58, -Math.PI * 0.58, 0]) {
    const x = FIRE.x + Math.cos(a) * 1.55;
    const z = FIRE.z + Math.sin(a) * 1.55;
    k.prop('stump', x, z, a, { w: 0.45, h: 0.36, d: 0.45, color: '#7a5636' }).scale.setScalar(0.75);
    k.solidRect(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0.36);
  }
  k.snowy = false;
  k.prop('firewoodStack', 12.3, -0.8, -Math.PI / 2, { w: 1.1, h: 0.65, d: 0.95, color: '#7a5636' });
  footprint(k, 12.3, -0.8, 1.1, 0.9, Math.PI / 2, 0.65);
  k.interests.push({ kind: 'bench', x: 12.3, z: -0.8, r: 0.8 });
}

/** 동쪽: 얼음 연못(걸을 수 있음)과 둘레 눈 둔덕, 눈사람, 눈 덮인 벤치 2개, 썰매(0.4m) */
function iceSide(k: MapKit): void {
  const ice = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), new THREE.MeshStandardMaterial({ color: '#a9c4d6', roughness: 0.12, metalness: 0.15 }));
  ice.rotation.x = -Math.PI / 2;
  ice.position.set(POND.x, 0.008, POND.z);
  ice.receiveShadow = true;
  k.group.add(ice);
  // 둘레 눈 둔덕 16개: 걸어서 넘는 낮은 둔덕 (윗면 0.17m, 턱 0.2m 아래)
  const mounds: { x: number; z: number; rotY: number; scale: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const x = POND.x + Math.cos(a) * (POND.r + 0.35);
    const z = POND.z + Math.sin(a) * (POND.r + 0.35);
    if (x < -19.3) continue;
    mounds.push({ x, z, rotY: a, scale: 0.42 });
    k.circles.push({ x, z, r: 0.32, top: 0.17 });
  }
  k.scatter('snowPile', mounds);

  k.prop('snowman', -8.6, 2.6, 2.4, { w: 0.85, h: 1.8, d: 0.85, color: '#f2f4f7' });
  k.circles.push({ x: -8.6, z: 2.6, r: 0.42 });
  k.interests.push({ kind: 'pot', x: -8.6, z: 2.0, r: 0.9 }); // 다가가 냄새 맡고 올려다보는 곳
  k.snowy = true;
  bench(k, -14.8, 3.4 + 0.6, Math.PI);
  bench(k, -7.6, -5.6, -Math.PI / 2);
  k.snowy = false;
  k.prop('sled', -10.3, -8.6, -0.5, { w: 0.56, h: 0.45, d: 1.5, color: '#8a5a3a' });
  footprint(k, -10.3, -8.6, 0.5, 1.4, -0.5, 0.4);
  k.interests.push({ kind: 'bench', x: -10.3, z: -8.6, r: 0.8 });
}

/** 남쪽 입구: 지팡이 사탕 아치, 길 양옆 화분 트리 4개, 나무 순록 2개(다리만 막힘) */
function entrance(k: MapKit): void {
  for (const x of [-1.7, 1.7]) {
    k.prop('candyCane', x, -12.6, x < 0 ? 0 : Math.PI, { w: 0.15, h: 2.4, d: 0.15, color: '#d23b3b' });
    k.circles.push({ x, z: -12.6, r: 0.1 });
  }
  for (const [x, z] of [[-2.2, -7.75], [2.2, -7.75], [-2.2, -10.4], [2.2, -10.4]] as const) {
    k.prop('xmasTreeSmall', x, z, x + z, { w: 0.8, h: 1.45, d: 0.8, color: '#2f6b3a' });
    k.circles.push({ x, z, r: 0.36 });
    k.interests.push({ kind: 'pot', x, z, r: 0.8 });
  }
  for (const [x, z, rot] of [[-4.9, -6.4, Math.PI + 0.35], [4.9, -6.4, Math.PI - 0.35]] as const) { // 입구(남쪽)를 보며 살짝 바깥으로
    k.prop('woodenReindeer', x, z, rot, { w: 0.5, h: 1.9, d: 1.4, color: '#8a5a3a' });
    for (const s of [-0.55, 0.55]) k.circles.push({ x: x + Math.sin(rot) * s, z: z + Math.cos(rot) * s, r: 0.13 }); // 앞다리·뒷다리
    k.lights.push({ x: x + Math.sin(rot) * 0.75, y: 1.55, z: z + Math.cos(rot) * 0.75, color: '#ff4a3c', light: false }); // 빨간 코
  }
}

/** 맵 안쪽 가장자리의 큰 소나무 (눈 얹음) */
function innerPines(k: MapKit): void {
  const model = k.models.tallPine;
  const h0 = model ? new THREE.Box3().setFromObject(model).max.y : 1;
  k.snowy = true;
  for (const [x, z, h] of [[18, 13, 7], [-18, 13, 7.5], [-17.5, 7.5, 5.5], [18.5, -0.3, 6], [11, -12, 6.5], [-11.5, -13, 6], [-18, -13, 7], [18.5, -13.5, 6.5]] as const) {
    const o = k.prop('tallPine', x, z, x * 1.3 + z, { w: 0.8, h, d: 0.8, color: '#2f5a3a' });
    if (model) o.scale.setScalar(h / h0);
    k.circles.push({ x, z, r: 0.4 });
  }
  k.snowy = false;
}

/** 눈 더미 9개 (걸어서 넘는 둔덕, 윗면 0.17m) */
function snowPiles(k: MapKit): void {
  for (const [x, z, s] of [[14.5, -9.6, 0.8], [16.5, -13, 1], [15, -0.6, 0.6], [8.5, -11, 0.7], [-5.5, -12, 0.8], [-15.5, -11, 0.9], [-17.5, 4.5, 0.7], [-13, 13.2, 0.8], [16.5, 10.5, 0.9]] as const) {
    k.prop('snowPile', x, z, x, { w: 1.6 * s, h: 0.4 * s, d: 1.2 * s, color: '#f2f4f7' }).scale.setScalar(s);
    k.circles.push({ x, z, r: 0.55 * s, top: 0.17 });
  }
}

/** 둘레 바깥 눈 덮인 소나무 숲 (풍경용, 갈 수 없음). 한 번에 그린다 */
function pineRing(k: MapKit, b: Rect): void {
  const rng = createRng(6161);
  const model = k.models.tallPine;
  const h0 = model ? new THREE.Box3().setFromObject(model).max.y : 1;
  const items: { x: number; z: number; rotY: number; scale: number }[] = [];
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const per = 2 * (w + d);
  for (let i = 0; i < 64; i++) {
    let s = (i / 64) * per + range(rng, -1, 1);
    s = ((s % per) + per) % per;
    const out = range(rng, 1.5, 8);
    let x: number;
    let z: number;
    if (s < w) (x = b.minX + s), (z = b.maxZ + out);
    else if (s < w + d) (x = b.maxX + out), (z = b.maxZ - (s - w));
    else if (s < 2 * w + d) (x = b.maxX - (s - w - d)), (z = b.minZ - out);
    else (x = b.minX - out), (z = b.minZ + (s - 2 * w - d));
    items.push({ x, z, rotY: rng() * 6.28, scale: range(rng, 5.5, 9) / h0 });
  }
  k.snowy = true;
  k.scatter('tallPine', items);
  k.snowy = false;
}

/**
 * 눈 내리기: 광장 위 상자 안에 눈송이를 흩뿌리고, 프레임마다 천천히 떨어뜨리며 살짝 흔든다. 바닥에 닿으면 위로 돌린다.
 * 점(Points) 하나로 그린다 (그리기 1회)
 */
function snowfall(): { points: THREE.Points; update: (dt: number) => void } {
  const N = 1400;
  const W = 52;
  const D = 44;
  const H = 14;
  const rng = createRng(6262);
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rng() - 0.5) * W;
    pos[i * 3 + 1] = rng() * H;
    pos[i * 3 + 2] = (rng() - 0.5) * D;
    speed[i] = range(rng, 0.6, 1.3);
    phase[i] = rng() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute('position', attr);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H / 2, 0), Math.hypot(W, D, H) / 2);
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: '#ffffff', map: flakeTexture(), size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  points.name = 'snowfall';
  points.frustumCulled = false;
  let t = 0;
  const update = (dt: number) => {
    t += dt;
    for (let i = 0; i < N; i++) {
      let y = pos[i * 3 + 1] - speed[i] * dt;
      if (y < 0) y += H;
      pos[i * 3 + 1] = y;
      pos[i * 3] += Math.sin(t * 0.8 + phase[i]) * 0.15 * dt;
    }
    attr.needsUpdate = true;
  };
  return { points, update };
}

/** 둥근 눈송이 그림 (가운데가 진하고 가장자리가 흐린 원). 점은 기본이 네모라 가까이 오면 네모가 보인다. 캔버스 없이 만든다 */
function flakeTexture(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const a = Math.max(0, Math.min(1, (1 - d) * 2.2));
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}
