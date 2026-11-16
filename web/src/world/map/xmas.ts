import * as THREE from 'three';
import { createRng, range } from '../../core/rng';
import type { Rect } from '../collision';
import { mergeStatic } from '../merge';
import { MapKit } from '../parts/kit';
import { feedingShelter } from '../parts/props';
import type { PropId, PropModels } from '../propModels';
import type { Neighborhood } from './neighborhood';

/**
 * 크리스마스 맵 "눈 오는 광장" (2026-11-16). 소품은 직접 만든 모델 18종 (tools/blender/xmas_props.py).
 * 가운데 돌바닥 광장에 큰 트리와 선물 상자, 둘레에 리본 가로등. 북쪽에 노점 셋과 산타 우체통,
 * 서쪽에 통나무 오두막·장작 더미·모닥불(곁이 따뜻한 자리)·털실 공, 동쪽에 눈사람·썰매·나무 순록, 남쪽 입구에 지팡이 사탕 기둥.
 * 눈이 내린다 (update). 배치·충돌은 코드로 정한다 (모델이 없어도 같은 맵).
 */
export const XMAS_BOUNDS: Rect = { minX: -20, maxX: 20, minZ: -16, maxZ: 16 };

const PLAZA_R = 10;
const TREE_R = 2.1; // 큰 트리 아래쪽 가지 반지름 (몸이 들어가지 못한다)
const FIRE = { x: -8.5, z: -2 };
const FOOD = { x: -9, z: -9.8 }; // 입구에서 서쪽 (광장 둘레 화분 트리 바깥)


export function buildXmas(models: PropModels = {}): Neighborhood {
  const b = XMAS_BOUNDS;
  const k = new MapKit(createRng(6060));
  k.models = models;
  ground(k);

  k.beginZone('plaza');
  plaza(k);
  market(k);
  cabinCorner(k);
  snowyEast(k);
  entrance(k);
  edgeTrees(k);
  feedingShelter(k, FOOD.x, FOOD.z);

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
    spawn: { x: 0, z: -11, heading: 0 },
    foodStation: FOOD,
    npcSpot: { x: 3.2, z: -6.5 },
    mergedAway,
    update: snow.update,
  };
}

/** 회전한 소품의 바닥 사각형을 축에 맞춘 사각형으로 (충돌용, 조금 넉넉하게) */
function footprint(k: MapKit, x: number, z: number, w: number, d: number, rotY: number, top?: number): void {
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  k.solidRect(x - hw, x + hw, z - hd, z + hd, top);
}

/** 눈 덮인 땅과 지평선까지 이어지는 바깥 눈밭 */
function ground(k: MapKit): void {
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), k.mat('#e4e9ef', 1));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  k.group.add(outer);
}

/** 가운데 돌바닥 광장: 큰 트리, 둘레 선물 상자(올라섬), 리본 가로등 여덟 개 */
function plaza(k: MapKit): void {
  const stone = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 48), k.mat('#c9c3ba', 1));
  stone.rotation.x = -Math.PI / 2;
  stone.position.y = 0.003;
  stone.receiveShadow = true;
  k.group.add(stone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA_R - 0.35, PLAZA_R, 48), k.mat('#a49c90', 1));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  k.group.add(ring);

  k.occluders.push(k.prop('xmasTreeLarge', 0, 0, 0.3, { w: 4.2, h: 6.5, d: 4.2, color: '#2f6b3a' }));
  k.circles.push({ x: 0, z: 0, r: TREE_R });

  // 선물 상자: 트리 둘레 (윗면에 올라선다)
  const gifts: [PropId, number, number, number, number, number][] = [
    // id, 각도, 거리, 폭, 깊이, 윗면
    ['giftL', -0.9, 2.75, 0.83, 0.83, 0.8],
    ['giftM', -2.3, 2.6, 0.54, 0.54, 0.5],
    ['giftS', 0.35, 2.5, 0.33, 0.33, 0.3],
    ['giftOpen', 2.3, 2.75, 0.66, 0.66, 0.6],
    ['giftM', 1.35, 2.6, 0.54, 0.54, 0.5],
    ['giftS', -1.55, 2.5, 0.33, 0.33, 0.3],
  ];
  for (const [id, a, r, w, d, top] of gifts) {
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    k.prop(id, x, z, a, { w, h: top, d, color: '#b33a3a' });
    footprint(k, x, z, w, d, a, top);
  }
  k.interests.push({ kind: 'bench', x: Math.cos(-0.9) * 2.75, z: Math.sin(-0.9) * 2.75, r: 0.9 });

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 7;
    const z = Math.sin(a) * 7;
    k.prop('ribbonLamp', x, z, -a + Math.PI / 2, { w: 0.2, h: 3.2, d: 0.2, color: '#222' });
    k.circles.push({ x, z, r: 0.13 });
  }
  for (const [x, z] of [[4.2, -4.6], [-4.4, 4.2]] as const) k.interests.push({ kind: 'sunspot', x, z, r: 1 });
}

/** 북쪽 노점 셋(광장을 향함)과 산타 우체통 */
function market(k: MapKit): void {
  for (const [x, z] of [[-6, 11.5], [0, 12.6], [6, 11.5]] as const) {
    const rot = Math.atan2(-x, -z); // 앞(+z)이 광장 가운데를 본다
    k.occluders.push(k.prop('marketStall', x, z, rot, { w: 2.6, h: 2.5, d: 1.66, color: '#8a5a3a' }));
    footprint(k, x, z, 2.5, 1.55, rot);
  }
  k.prop('santaMailbox', 3.1, 12.4, Math.PI, { w: 0.43, h: 1.37, d: 0.59, color: '#b33a3a' });
  k.circles.push({ x: 3.1, z: 12.4, r: 0.22 });
}

/** 서쪽: 통나무 오두막(앞이 광장 쪽), 장작 더미(올라섬), 모닥불과 그 곁의 따뜻한 자리, 털실 공 */
function cabinCorner(k: MapKit): void {
  k.occluders.push(k.prop('logCabin', -15, 4, Math.PI / 2, { w: 5.4, h: 4.6, d: 4.4, color: '#7a5636' }));
  footprint(k, -15, 4, 5.3, 4.3, Math.PI / 2);
  k.prop('firewoodStack', -12, 8.3, Math.PI / 2, { w: 1.2, h: 0.62, d: 0.94, color: '#7a5636' });
  footprint(k, -12, 8.3, 1.15, 0.9, Math.PI / 2, 0.6);
  k.interests.push({ kind: 'bench', x: -12, z: 8.3, r: 0.9 });

  k.prop('firePit', FIRE.x, FIRE.z, 0, { w: 1.3, h: 0.5, d: 1.3, color: '#6b6b6b' });
  k.circles.push({ x: FIRE.x, z: FIRE.z, r: 0.72 });
  k.interests.push({ kind: 'sunspot', x: FIRE.x + 0.4, z: FIRE.z - 1.4, r: 0.9 }); // 모닥불 곁 따뜻한 자리
  k.prop('yarnBall', FIRE.x + 1.5, FIRE.z - 1.1, 0.6, { w: 0.22, h: 0.22, d: 0.22, color: '#c0392b' });
}

/** 동쪽: 눈사람, 썰매(좌석에 올라섬), 나무 순록 둘, 눈 더미(올라섬) */
function snowyEast(k: MapKit): void {
  k.prop('snowman', 8.5, -5, -2.2, { w: 0.9, h: 1.8, d: 0.9, color: '#f2f4f7' });
  k.circles.push({ x: 8.5, z: -5, r: 0.45 });
  k.prop('sled', 10.3, -6.8, 0, { w: 0.56, h: 0.45, d: 1.5, color: '#8a5a3a' });
  footprint(k, 10.3, -6.8, 0.5, 1.4, 0, 0.42);
  for (const [x, z, rot] of [[8, 5.5, -Math.PI / 2], [9.6, 6.6, -2.3]] as const) {
    k.prop('woodenReindeer', x, z, rot, { w: 0.5, h: 1.9, d: 1.4, color: '#8a5a3a' });
    footprint(k, x, z, 0.4, 1.2, rot);
  }
  for (const [x, z, s] of [[13, -10.5, 1], [-14, -12, 1.1], [15.5, 9.5, 0.9], [-17, -3.5, 1], [16.5, -1, 1]] as const) {
    k.prop('snowPile', x, z, x, { w: 1.6 * s, h: 0.4 * s, d: 1.2 * s, color: '#f2f4f7' }).scale.setScalar(s);
    k.circles.push({ x, z, r: 0.5 * s, top: 0.36 * s });
  }
}

/** 남쪽 입구: 지팡이 사탕 기둥 둘 */
function entrance(k: MapKit): void {
  for (const x of [-1.9, 1.9]) {
    k.prop('candyCane', x, -13.6, x < 0 ? 0 : Math.PI, { w: 0.15, h: 2.4, d: 0.15, color: '#d23b3b' });
    k.circles.push({ x, z: -13.6, r: 0.11 });
  }
}

/** 광장 바깥 둘레의 화분 트리 (노점·오두막 자리는 피한다) */
function edgeTrees(k: MapKit): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 11;
    const z = Math.sin(a) * 11;
    if (z > 8 && Math.abs(x) < 9) continue; // 노점
    if (x < -9 && z > -1 && z < 9) continue; // 오두막
    if (Math.abs(x) < 3 && z < -9) continue; // 입구
    k.prop('xmasTreeSmall', x, z, a, { w: 0.8, h: 1.5, d: 0.8, color: '#2f6b3a' });
    k.circles.push({ x, z, r: 0.36 });
    k.interests.push({ kind: 'pot', x, z, r: 0.9 });
  }
}

/** 둘레 바깥 소나무 숲 (풍경용, 갈 수 없음). 한 번에 그린다 */
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
  k.scatter('tallPine', items);
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
