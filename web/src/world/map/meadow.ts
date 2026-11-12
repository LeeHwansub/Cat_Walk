import * as THREE from 'three';
import { createRng, range } from '../../core/rng';
import type { Rect } from '../collision';
import { mergeStatic } from '../merge';
import { MapKit } from '../parts/kit';
import { feedingShelter } from '../parts/props';
import type { PropId, PropModels } from '../propModels';
import { grassTexture } from '../textures';
import type { Neighborhood } from './neighborhood';

/**
 * 들판 맵 (D-58 4단계, 2026-11-12). 사용자 선택: 탁 트인 풀밭 + 연못, 평평한 땅, 추천 소품 20종.
 * 가운데는 넓은 풀밭과 꽃밭, 남동쪽에 부들·연잎이 있는 연못, 서쪽에서 동쪽으로 굽은 흙길,
 * 북서쪽 피크닉 테이블 옆 먹이 쉼터. 남쪽·서쪽은 나무 울타리, 둘레 바깥은 숲.
 * 배치·충돌은 코드로 정한다 (모델이 없어도 같은 맵, 보이는 것만 모델).
 */
export const MEADOW_BOUNDS: Rect = { minX: -22, maxX: 22, minZ: -16, maxZ: 16 };

const POND = { x: 9, z: -7, r: 3 };
/** 흙길 (서 → 동) */
const TRAIL: [number, number][] = [[-21.5, 0], [-15, 1], [-8, -0.8], [-1, 1.4], [5, 0], [11, 2.6], [17, 3.6], [21.5, 5]];
const TABLE = { x: -7, z: 7.5 };
const FOOD = { x: -10.8, z: 9.2 };
const FLOWER_PATCHES: [number, number, number][] = [[-1, 7, 2.6], [14, 9.5, 2.4], [-12, -7, 2.6], [2, -9.5, 2.2]];

type Item = { x: number; z: number; rotY: number; scale: number };

export function buildMeadow(models: PropModels = {}): Neighborhood {
  const b = MEADOW_BOUNDS;
  const k = new MapKit(createRng(4040));
  k.models = models;
  ground(k, b);

  k.beginZone('meadow');
  const nearTrail = trailDistance;
  trail(k);
  pond(k);
  picnicCorner(k);
  trees(k);
  rocksAndStumps(k);
  bushes(k);
  fences(k, b);
  if (k.models.signpost) k.prop('signpost', -19.2, 2.2, 0.4, { w: 0.15, h: 1.6, d: 0.15, color: '#8a6a48' });
  k.circles.push({ x: -19.2, z: 2.2, r: 0.12 });

  // 관심 지점: 꽃밭, 풀밭, 햇볕 자리 (자동 생활이 찾아간다)
  for (const [x, z, r] of FLOWER_PATCHES) k.interests.push({ kind: 'flower', x, z, r });
  for (let n = 0, i = 0; n < 12 && i < 200; i++) {
    const x = range(k.rng, b.minX + 3, b.maxX - 3);
    const z = range(k.rng, b.minZ + 3, b.maxZ - 3);
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5 || nearTrail(x, z) < 1.2) continue;
    k.interests.push({ kind: 'grass', x, z, r: 1 });
    n++;
  }
  for (const [x, z] of [[-6, -4], [3, -3.5], [12, 6.5], [-14, 4.5]]) k.interests.push({ kind: 'sunspot', x, z, r: 1 });

  meadowPlants(k, b);

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
    spawn: { x: -16, z: 0.2, heading: Math.PI / 2 },
    foodStation: FOOD,
    npcSpot: { x: -4, z: 4.2 },
    mergedAway,
  };
}

/** 점 (x, z)에서 흙길까지 거리 */
function trailDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < TRAIL.length; i++) {
    const [ax, az] = TRAIL[i];
    const [bx, bz] = TRAIL[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  return best;
}

/** 들판 바닥(잔디)과 지평선까지 이어지는 바깥 풀밭 */
function ground(k: MapKit, b: Rect): void {
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), k.mat('#7d9656'));
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

/** 굽은 흙길: 흙길 조각 모델을 이어 붙인다 (없으면 흙색 판). 충돌 없음 */
function trail(k: MapKit): void {
  const dirt = k.mat('#b59a72', 1);
  for (let i = 0; i + 1 < TRAIL.length; i++) {
    const [ax, az] = TRAIL[i];
    const [bx, bz] = TRAIL[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az);
    const n = Math.ceil(len / 2.6);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (k.models.dirtTrail) k.prop('dirtTrail', x, z, rot + (j % 2) * Math.PI, { w: 1.4, h: 0.02, d: 3, color: '#b59a72' });
      else k.flat(1.4, len / n + 0.1, dirt, x, z, rot);
    }
  }
}

/** 연못: 물, 둘레 부들, 물 위 연잎, 흙길에서 물가로 가는 디딤돌, 물가 큰 바위 */
function pond(k: MapKit): void {
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), new THREE.MeshStandardMaterial({ color: '#5f8fa6', roughness: 0.1, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, 0.012, POND.z);
  water.receiveShadow = true;
  k.group.add(water);
  const bank = new THREE.Mesh(new THREE.RingGeometry(POND.r - 0.05, POND.r + 0.35, 48), k.mat('#8a7a5c', 1));
  bank.rotation.x = -Math.PI / 2;
  bank.position.set(POND.x, 0.008, POND.z);
  bank.receiveShadow = true;
  k.group.add(bank);
  k.circles.push({ x: POND.x, z: POND.z, r: POND.r + 0.1 });
  k.interests.push({ kind: 'pond', x: POND.x, z: POND.z, r: POND.r + 0.8 });

  const reeds: Item[] = [];
  for (let i = 0; i < 26; i++) {
    // 북쪽·동쪽 물가에 몰리게 (서쪽은 디딤돌로 다가가는 쪽이라 비운다)
    const a = range(k.rng, -0.9, 2.4);
    const r = POND.r + range(k.rng, -0.15, 0.1);
    reeds.push({ x: POND.x + Math.cos(a) * r, z: POND.z - Math.sin(a) * r, rotY: k.rng() * 6.28, scale: range(k.rng, 0.8, 1.2) });
  }
  k.scatter('cattail', reeds);
  const pads: Item[] = [];
  for (let i = 0; i < 9; i++) {
    const a = k.rng() * Math.PI * 2;
    const r = range(k.rng, 0.6, POND.r - 0.6);
    pads.push({ x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r, rotY: k.rng() * 6.28, scale: range(k.rng, 0.7, 1.2) });
  }
  k.scatter('lilyPad', pads);
  const stone = k.mat('#a49d90', 1);
  for (const [x, z, rot] of [[5.2, -1.4, 0.3], [5.0, -2.6, 1.2], [5.3, -3.8, 0.6], [5.6, -5.0, 2.0]] as const) {
    if (k.models.slabStone) k.prop('slabStone', x, z, rot, { w: 0.7, h: 0.04, d: 0.5, color: '#a49d90' });
    else k.flat(0.7, 0.5, stone, x, z, rot);
  }
}

/** 북서쪽 쉼터: 피크닉 테이블(올라설 수 있음)과 먹이 쉼터 */
function picnicCorner(k: MapKit): void {
  k.prop('picnicTable', TABLE.x, TABLE.z, 0, { w: 2, h: 0.75, d: 1.6, color: '#9a6e45' });
  k.solidRect(TABLE.x - 1.0, TABLE.x + 1.0, TABLE.z - 0.8, TABLE.z + 0.8, 0.74);
  k.interests.push({ kind: 'bench', x: TABLE.x, z: TABLE.z, r: 1.6 });
  feedingShelter(k, FOOD.x, FOOD.z);
}

/** 들판 안쪽 나무: 둥근 활엽수(그늘)·소나무. 높이는 놓을 때 정한다. 충돌은 줄기 */
function trees(k: MapKit): void {
  const list: [PropId, number, number, number][] = [
    ['roundTree', -14, 9, 5.5], ['roundTree', 2, 11.5, 6], ['roundTree', 17, 11, 5.2], ['roundTree', -3, -12, 5], ['roundTree', 17.5, -11.5, 5.5],
    ['youngPine', -18.5, -12, 2.6], ['youngPine', 19.5, 13, 2.4], ['youngPine', 5, -13, 2.2], ['youngPine', -19, 12, 2.7], ['youngPine', 9, 13.5, 2.3],
    ['tallPine', 20, -14, 7], ['tallPine', -20, -5.5, 7.5], ['tallPine', 13.5, 14, 7.2],
  ];
  for (const [id, x, z, h] of list) {
    placeTree(k, id, x, z, h);
    k.circles.push({ x, z, r: id === 'youngPine' ? 0.3 : 0.25 });
    k.interests.push({ kind: 'grass', x, z, r: 1.2 });
  }
}

function placeTree(k: MapKit, id: PropId, x: number, z: number, height: number): void {
  const model = k.models[id];
  const o = k.prop(id, x, z, x * 1.3 + z, { w: 0.8, h: height, d: 0.8, color: '#4f7d3a' });
  if (model) o.scale.setScalar(height / new THREE.Box3().setFromObject(model).max.y);
}

/** 큰 바위 2개·그루터기 2개 (올라설 수 있다). 충돌은 모델이 없어도 같다 */
function rocksAndStumps(k: MapKit): void {
  for (const [x, z, rot] of [[13.8, -10.6, 0], [-12.5, -11, Math.PI / 2]] as const) {
    k.prop('boulder', x, z, rot, { w: 1.9, h: 0.58, d: 1.2, color: '#8f8a80' });
    const [hw, hd] = rot === 0 ? [0.8, 0.45] : [0.45, 0.8];
    k.solidRect(x - hw, x + hw, z - hd, z + hd, 0.55);
  }
  for (const [x, z] of [[-3, -5.5], [15, 6]] as const) {
    k.prop('stump', x, z, x, { w: 0.6, h: 0.46, d: 0.6, color: '#7a5636' });
    k.solidRect(x - 0.28, x + 0.28, z - 0.25, z + 0.25, 0.46);
  }
}

/** 들판 가장자리 꽃덤불 (보라 꽃덤불·흰 들꽃 덤불) */
function bushes(k: MapKit): void {
  for (const [x, z] of [[-16.5, -14], [0, 14.4], [20.6, -7.5], [-20.2, 7]] as const) {
    k.occluders.push(k.prop('buddleia', x, z, x + z, { w: 1, h: 1.1, d: 1, color: '#5d7a45' }));
    k.circles.push({ x, z, r: 0.45 });
    k.interests.push({ kind: 'flower', x, z, r: 1.3 });
  }
  for (const [x, z] of [[-9, -13.8], [6.5, 14], [20.4, 0.8], [-20.4, -13.5]] as const) {
    k.prop('cowParsley', x, z, x, { w: 0.6, h: 0.7, d: 0.6, color: '#7c9a5a' });
    k.circles.push({ x, z, r: 0.25 });
  }
}

/**
 * 남쪽·서쪽 나무 울타리 (조각을 이어서, 한 번에 그린다). 남쪽에는 울타리 문, 서쪽에는 디딤대.
 * 위가 좁은 담처럼 올라서서 걸을 수 있다 (윗면 0.86m)
 */
function fences(k: MapKit, b: Rect): void {
  const SEG = 1.6;
  const z = b.minZ + 0.35;
  const x = b.minX + 0.35;
  const pieces: Item[] = [];
  const gateX = -6.4;
  const stileZ = 9.6;
  for (let px = b.minX + 0.35 + SEG / 2; px < b.maxX - SEG / 2; px += SEG) {
    if (Math.abs(px - gateX) < SEG / 2) continue;
    pieces.push({ x: px, z, rotY: 0, scale: 1 });
  }
  for (let pz = b.minZ + 0.35 + SEG * 1.5; pz < b.maxZ - SEG / 2; pz += SEG) {
    if (Math.abs(pz - stileZ) < SEG / 2) continue;
    pieces.push({ x, z: pz, rotY: Math.PI / 2, scale: 1 });
  }
  const inst = k.scatter('fence', pieces);
  if (inst) inst.castShadow = true;
  else {
    const wood = k.mat('#7a5a3c');
    for (const y of [0.35, 0.7]) {
      k.box(b.maxX - b.minX - 0.7, 0.08, 0.06, wood, (b.minX + b.maxX) / 2, y, z);
      k.box(0.06, 0.08, b.maxZ - b.minZ - 0.7, wood, x, y, (b.minZ + b.maxZ) / 2);
    }
  }
  k.prop('fenceGate', gateX, z, 0, { w: 1.6, h: 1, d: 0.1, color: '#7a5a3c' });
  k.prop('stile', x, stileZ, Math.PI / 2, { w: 1.5, h: 1, d: 0.6, color: '#8a7a68' });
  k.solidRect(b.minX + 0.25, b.maxX, z - 0.1, z + 0.1, 0.86);
  k.solidRect(x - 0.1, x + 0.1, b.minZ + 0.25, b.maxZ, 0.86);
}

/**
 * 풀밭 식물 (Insect World 키트를 실제 크기로): 들풀·데이지·민들레·토끼풀. 종류마다 InstancedMesh 하나.
 * 데이지·민들레는 꽃밭 자리에 몰리게. 흙길·연못·쉼터는 피한다
 */
function meadowPlants(k: MapKit, b: Rect): void {
  const rng = createRng(4141);
  const free = (x: number, z: number) =>
    trailDistance(x, z) > 0.9 &&
    Math.hypot(x - POND.x, z - POND.z) > POND.r + 0.5 &&
    !(Math.abs(x - TABLE.x) < 1.4 && Math.abs(z - TABLE.z) < 1.2) &&
    !(Math.abs(x - FOOD.x) < 1 && Math.abs(z - FOOD.z) < 1.2) &&
    !(x > 4.6 && x < 6.2 && z < -1 && z > -5.6);
  const spread = (n: number, s0: number, s1: number): Item[] => {
    const out: Item[] = [];
    for (let i = 0; out.length < n && i < n * 30; i++) {
      const x = range(rng, b.minX + 1, b.maxX - 1);
      const z = range(rng, b.minZ + 1, b.maxZ - 1);
      if (free(x, z)) out.push({ x, z, rotY: rng() * Math.PI * 2, scale: range(rng, s0, s1) });
    }
    return out;
  };
  const patches = (perPatch: number, s0: number, s1: number): Item[] => {
    const out: Item[] = [];
    for (const [cx, cz, r] of FLOWER_PATCHES) {
      for (let n = 0, i = 0; n < perPatch && i < perPatch * 10; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * r;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        if (!free(x, z)) continue;
        out.push({ x, z, rotY: rng() * 6.28, scale: range(rng, s0, s1) });
        n++;
      }
    }
    return out;
  };
  // 한 포기가 500~790면이라 무겁다 (처음 배치에서 맵 22만 면 중 14만 면). 수를 줄이고 꽃은 꽃밭에 모아 크게
  k.scatter('grassTuft', spread(60, 1.0, 1.6));
  k.scatter('daisy', [...patches(11, 1.1, 1.5), ...spread(4, 0.9, 1.2)]);
  k.scatter('dandelion', [...patches(5, 1.0, 1.4), ...spread(4, 0.9, 1.2)]);
  k.scatter('clover', spread(25, 1.0, 1.6));
  flowerDots(k, free, rng);
}

/**
 * 꽃밭의 작은 꽃송이 (코드로 그림, 사용자 선택 2026-11-12 "가벼운 꽃 점 더하기"): 송이마다 꽃 머리(20면)와 잎(8면).
 * 꽃밭 가운데일수록 촘촘하다. 송이마다 색이 다르고, 한 번에 그린다. 모델이 없어도 있다
 */
function flowerDots(k: MapKit, free: (x: number, z: number) => boolean, rng: () => number): void {
  const PER_PATCH = 180;
  const colors = ['#ffffff', '#fff6d8', '#f6d743', '#f2a7c3', '#e86f9e', '#b88be0', '#9fc4f0'];
  const spots: { x: number; z: number; y: number; s: number; c: string }[] = [];
  for (const [cx, cz, r] of FLOWER_PATCHES) {
    // 꽃밭마다 주로 쓰는 색 두 가지 + 가끔 다른 색
    const main = [colors[Math.floor(rng() * colors.length)], colors[Math.floor(rng() * colors.length)]];
    for (let n = 0, i = 0; n < PER_PATCH && i < PER_PATCH * 6; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.pow(rng(), 0.7) * r * 1.15;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (!free(x, z)) continue;
      const c = rng() < 0.75 ? main[n % 2] : colors[Math.floor(rng() * colors.length)];
      spots.push({ x, z, y: 0.08 + rng() * 0.12, s: 0.8 + rng() * 0.6, c });
      n++;
    }
  }
  const head = new THREE.IcosahedronGeometry(0.046, 0);
  head.scale(1, 0.55, 1);
  const heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
  const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.16, 4), k.mat('#5c8a3e'), spots.length);
  const m = new THREE.Matrix4();
  const one = new THREE.Quaternion();
  const col = new THREE.Color();
  spots.forEach((p, i) => {
    heads.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y, p.z), one, new THREE.Vector3(p.s, p.s, p.s)));
    heads.setColorAt(i, col.set(p.c));
    leaves.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0.07, p.z), one, new THREE.Vector3(1, p.y / 0.14, 1)));
  });
  heads.name = 'flowerDots';
  leaves.name = 'flowerLeaves';
  heads.castShadow = leaves.castShadow = false;
  heads.receiveShadow = leaves.receiveShadow = true;
  k.group.add(heads, leaves);
  k.unmerged.push(heads, leaves);
}

/** 둘레 바깥 숲 (풍경용, 갈 수 없음): 소나무·활엽수를 두세 겹으로. 종류마다 한 번에 그린다. 농장 맵도 함께 쓴다 */
export function forestRing(k: MapKit, b: Rect): void {
  const rng = createRng(4242);
  const pines: Item[] = [];
  const rounds: Item[] = [];
  const pineH = k.models.tallPine ? new THREE.Box3().setFromObject(k.models.tallPine).max.y : 1;
  const roundH = k.models.roundTree ? new THREE.Box3().setFromObject(k.models.roundTree).max.y : 1;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const per = 2 * (w + d);
  for (let i = 0; i < 70; i++) {
    // 둘레를 따라 고르게, 바깥으로 2~9m
    let s = (i / 70) * per + range(rng, -1, 1);
    s = ((s % per) + per) % per;
    const out = range(rng, 2, 9);
    let x: number;
    let z: number;
    if (s < w) (x = b.minX + s), (z = b.maxZ + out);
    else if (s < w + d) (x = b.maxX + out), (z = b.maxZ - (s - w));
    else if (s < 2 * w + d) (x = b.maxX - (s - w - d)), (z = b.minZ - out);
    else (x = b.minX - out), (z = b.minZ + (s - 2 * w - d));
    const pine = rng() < 0.6;
    const h = pine ? range(rng, 6, 9.5) : range(rng, 5, 7.5);
    (pine ? pines : rounds).push({ x, z, rotY: rng() * 6.28, scale: h / (pine ? pineH : roundH) });
  }
  // 갈 수 없는 곳이라 그림자를 끈다 (그림자 그리기에서 3만 면을 아낀다)
  k.scatter('tallPine', pines);
  k.scatter('roundTree', rounds);
}
