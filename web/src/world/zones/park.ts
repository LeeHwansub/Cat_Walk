import * as THREE from 'three';
import { createRng, range } from '../../core/rng';
import type { Rect } from '../collision';
import type { MapKit } from '../parts/kit';
import { bench, flowerBed, tree } from '../parts/props';
import { grassTexture } from '../textures';

/**
 * 공원 구역 (동쪽, x 5 ~ 24): 잔디, 산책로, 나무, 벤치, 연못, 화단.
 * MVP 맵의 공원 부분을 그대로 옮겼다 (3-0, 모양 변화 없음).
 */
export function buildPark(k: MapKit, b: Rect, roadHalf: number): void {
  k.beginZone('park');
  const grass = grassTexture();
  grass.repeat.set(10, 14);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(19, 28), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  g.rotation.x = -Math.PI / 2;
  g.position.set(5 + 9.5, 0.001, 0);
  g.receiveShadow = true;
  k.group.add(g);

  const x0 = 5;
  // 골목과의 경계: 낮은 산울타리, 가운데는 입구
  const hedge = k.mat('#4a7038');
  for (const [z0, z1] of [[roadHalf, b.maxZ], [b.minZ, -roadHalf]]) {
    if (k.models.bush) {
      // 둥근 덤불을 줄지어 (소품 모델, 2026-11-10). 충돌은 같은 산울타리
      for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.15) k.occluders.push(k.prop('bush', x0, z, Math.PI / 2 + (z % 2) * 0.1, { w: 0.6, h: 0.7, d: 1.2, color: '#4a7038' }));
    } else {
      k.occluders.push(k.box(0.6, 0.7, z1 - z0, hedge, x0, 0.35, (z0 + z1) / 2));
    }
    k.solidRect(x0 - 0.3, x0 + 0.3, z0, z1);
  }
  // 산책로
  const path = k.mat('#c9b997', 1);
  k.flat(14, 2.2, path, 12.5, 0);
  k.flat(2.2, 22, path, 13.5, 0);

  const trees: [number, number, number][] = [
    [8, 6, 1.3], [8.5, -7, 1.5], [11, 11, 1.4], [17, 10, 1.6], [21, 4, 1.3], [21.5, -10, 1.5], [10.5, -11.5, 1.2], [18.5, 2.5, 1.1],
  ];
  const kinds = ['oak', 'maple', 'birch', 'oak', 'maple', 'oak', 'birch', 'maple'] as const;
  trees.forEach(([x, z, s], i) => tree(k, x, z, s, kinds[i]));

  // 벤치 (햇볕 드는 쉼터)
  bench(k, 10.5, 1.7, 0);
  bench(k, 15.2, 6, Math.PI / 2);
  bench(k, 16.5, -2.0, 0);

  // 연못
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), new THREE.MeshStandardMaterial({ color: '#5f8fa6', roughness: 0.1, metalness: 0.1 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(18, 0.01, -7);
  k.group.add(pond);
  if (k.models.rockS && k.models.rockM) {
    // 연못 둘레 돌 (소품 모델): 테두리 대신. 충돌은 연못 원 그대로
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      k.prop(i % 3 === 0 ? 'rockM' : 'rockS', 18 + Math.cos(a) * 2.4, -7 + Math.sin(a) * 2.4, a * 2.3, { w: 0.3, h: 0.2, d: 0.3, color: '#9b9488' });
    }
  } else {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.14, 8, 40), k.mat('#9b9488'));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(18, 0.06, -7);
    rim.receiveShadow = true;
    k.group.add(rim);
  }
  k.circles.push({ x: 18, z: -7, r: 2.45 });
  k.interests.push({ kind: 'pond', x: 18, z: -7, r: 3.1 });

  // 화단
  flowerBed(k, 9, 8.6, 3.2, 1.2);
  flowerBed(k, 13.2, -10.5, 2.6, 1.2);
  flowerBed(k, 20.5, 7.4, 1.6, 2.4);

  // 잔디밭 관심 지점과 햇볕 자리
  for (let i = 0; i < 10; i++) {
    k.interests.push({ kind: 'grass', x: range(k.rng, 6.5, 22.5), z: range(k.rng, -12.5, 12.5), r: 1 });
  }
  for (const [x, z] of [[9, 3.5], [19.5, 0.5], [12, -5], [17.5, 12]]) k.interests.push({ kind: 'sunspot', x, z, r: 1 });

  parkDecor(k);

  // 공원 바깥 담장
  const fence = k.mat('#7a6e5e');
  k.box(0.1, 1, b.maxZ - b.minZ, fence, b.maxX, 0.5, 0);
  k.box(b.maxX - x0, 1, 0.1, fence, (b.maxX + x0) / 2, 0.5, b.maxZ);
  k.box(b.maxX - x0, 1, 0.1, fence, (b.maxX + x0) / 2, 0.5, b.minZ);
}

/**
 * 공원 장식 (Nature & Forest 소품 모델, 2026-11-10): 쓰러진 통나무(올라설 수 있음), 산책로 가로등, 새집 기둥,
 * 잔디에 흩뿌린 들꽃·풀 포기, 나무 밑 고사리. 모델이 없으면 놓지 않는다 (장식).
 * 무작위는 따로 떼어 둔 난수로: 맵 난수 순서를 건드리면 뒤의 배치(배경 아파트 등)가 바뀐다
 */
function parkDecor(k: MapKit): void {
  const rng = createRng(1110);
  if (k.models.fallenLog) {
    const x = 18.5;
    const z = -12.2;
    const log = k.models.fallenLog;
    k.prop('fallenLog', x, z, 0, { w: 2.2, h: 0.5, d: 0.5, color: '#7a5636' });
    const box = new THREE.Box3().setFromObject(log);
    const top = box.max.y * 0.8; // 가지 끝을 빼고 통나무 윗면쯤
    k.solidRect(x + box.min.x + 0.1, x + box.max.x - 0.1, z - 0.22, z + 0.22, top);
  }
  for (const [x, z] of [[8.0, 1.35], [19.0, 1.35], [12.15, -6.5]] as const) {
    if (!k.models.lanternPost) break;
    k.prop('lanternPost', x, z, z > 0 ? Math.PI : 0, { w: 0.15, h: 2.2, d: 0.15, color: '#6b4f3a' });
    k.circles.push({ x, z, r: 0.12 });
  }
  if (k.models.birdhouse) {
    k.prop('birdhouse', 20.5, -3.5, 0.6, { w: 0.4, h: 1.6, d: 0.4, color: '#7a5636' });
    k.circles.push({ x: 20.5, z: -3.5, r: 0.15 });
  }
  // 잔디 위 (산책로·연못·화단은 피한다)
  const onLawn = (x: number, z: number) =>
    Math.abs(z) > 1.4 && Math.abs(x - 13.5) > 1.4 && Math.hypot(x - 18, z + 7) > 2.8 && !(x > 7.2 && x < 10.8 && z > 7.8 && z < 9.4) && !(x > 11.7 && x < 14.7 && z > -11.3 && z < -9.7) && !(x > 19.5 && x < 21.5 && z > 6 && z < 8.8);
  const lawn = (n: number, s0: number, s1: number) => {
    const out: { x: number; z: number; rotY: number; scale: number }[] = [];
    for (let i = 0; out.length < n && i < n * 20; i++) {
      const x = range(rng, 6, 23);
      const z = range(rng, -13.2, 13.2);
      if (onLawn(x, z)) out.push({ x, z, rotY: rng() * Math.PI * 2, scale: range(rng, s0, s1) });
    }
    return out;
  };
  // 들꽃: 화단 둘레에 몰리게 + 잔디에 드문드문
  const flowers = lawn(26, 0.8, 1.3);
  for (const [cx, cz, w, d] of [[9, 8.6, 3.2, 1.2], [13.2, -10.5, 2.6, 1.2], [20.5, 7.4, 1.6, 2.4]] as const) {
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      const x = cx + Math.cos(a) * (w / 2 + 0.35);
      const z = cz + Math.sin(a) * (d / 2 + 0.35);
      if (Math.abs(x - 13.5) > 1.4 && Math.abs(z) > 1.4) flowers.push({ x, z, rotY: rng() * 6.28, scale: range(rng, 0.9, 1.2) });
    }
  }
  k.scatter('wildflower', flowers);
  k.scatter('grassTuft', lawn(45, 0.8, 1.5));
  // 나무 밑 고사리
  const ferns: { x: number; z: number; rotY: number; scale: number }[] = [];
  for (const [x, z] of [[8, 6], [8.5, -7], [11, 11], [17, 10], [21, 4], [21.5, -10], [10.5, -11.5], [18.5, 2.5]]) {
    const a = rng() * Math.PI * 2;
    ferns.push({ x: x + Math.cos(a) * 0.7, z: z + Math.sin(a) * 0.7, rotY: rng() * 6.28, scale: range(rng, 0.8, 1.1) });
  }
  k.scatter('fern', ferns);
}
