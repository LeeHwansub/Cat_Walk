import * as THREE from 'three';
import { range } from '../../core/rng';
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
    const m = k.box(0.6, 0.7, z1 - z0, hedge, x0, 0.35, (z0 + z1) / 2);
    k.occluders.push(m);
    k.solidRect(x0 - 0.3, x0 + 0.3, z0, z1);
  }
  // 산책로
  const path = k.mat('#c9b997', 1);
  k.flat(14, 2.2, path, 12.5, 0);
  k.flat(2.2, 22, path, 13.5, 0);

  const trees: [number, number, number][] = [
    [8, 6, 1.3], [8.5, -7, 1.5], [11, 11, 1.4], [17, 10, 1.6], [21, 4, 1.3], [21.5, -10, 1.5], [10.5, -11.5, 1.2], [18.5, 2.5, 1.1],
  ];
  for (const [x, z, s] of trees) tree(k, x, z, s);

  // 벤치 (햇볕 드는 쉼터)
  bench(k, 10.5, 1.7, 0);
  bench(k, 15.2, 6, Math.PI / 2);
  bench(k, 16.5, -2.0, 0);

  // 연못
  const pond = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), new THREE.MeshStandardMaterial({ color: '#5f8fa6', roughness: 0.1, metalness: 0.1 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(18, 0.01, -7);
  k.group.add(pond);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.14, 8, 40), k.mat('#9b9488'));
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(18, 0.06, -7);
  rim.receiveShadow = true;
  k.group.add(rim);
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

  // 공원 바깥 담장
  const fence = k.mat('#7a6e5e');
  k.box(0.1, 1, b.maxZ - b.minZ, fence, b.maxX, 0.5, 0);
  k.box(b.maxX - x0, 1, 0.1, fence, (b.maxX + x0) / 2, 0.5, b.maxZ);
  k.box(b.maxX - x0, 1, 0.1, fence, (b.maxX + x0) / 2, 0.5, b.minZ);
}
