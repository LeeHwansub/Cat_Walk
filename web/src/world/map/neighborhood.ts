import * as THREE from 'three';
import type { InterestKind } from '../../behavior/types';
import { createRng, range, type Rng } from '../../core/rng';
import type { Circle, CollisionWorld, Rect } from '../collision';
import { asphaltTexture, brickTexture, facadeTexture, grassTexture } from '../textures';

export interface Interest {
  kind: InterestKind;
  x: number;
  z: number;
  r: number;
}

export interface Neighborhood {
  group: THREE.Group;
  collision: CollisionWorld;
  interests: Interest[];
  /** 카메라가 뚫고 들어가지 않게 레이캐스트할 큰 물체 */
  occluders: THREE.Object3D[];
  spawn: { x: number; z: number; heading: number };
  foodStation: { x: number; z: number };
  npcSpot: { x: number; z: number };
}

/**
 * MVP 맵: 한국 주택가 골목 + 작은 공원이 이어진 동네 (D-06, D-10)
 * 좌표: x는 서(-)→동(+), 골목 큰길은 x축 방향, 공원은 동쪽 끝.
 */
export const BOUNDS: Rect = { minX: -26, maxX: 24, minZ: -14, maxZ: 14 };
const ROAD_HALF = 2.5;
const WALL_Z = 3.3;

export function buildNeighborhood(): Neighborhood {
  const b = new Builder(createRng(2026));

  b.ground();
  b.roadMarkings();

  // ---- 북쪽 줄 (z +)
  b.villa(-25, -18.5, 1, 9.5, 'brick');
  b.sideAlley(-18.5, -15.5);
  b.house(-15.5, -8.5, 1, 4.6, '#e8dcc0');
  b.villa(-8.5, -1.5, 1, 10.5, '#dcd8d0');
  b.shop(-1.5, 3.6, 1);

  // ---- 남쪽 줄 (z -)
  b.house(-25, -19, -1, 4.2, '#d9cdb5');
  b.villa(-19, -12, -1, 9, '#e3d3b5');
  b.parkingLot(-12, -6);
  b.villa(-6, 1, -1, 10.5, 'brick');
  b.emptyLot(1, 4.6);

  // ---- 골목 소품
  for (const [x, z, color] of [[-21, 1.75, '#f2f2f2'], [-9.5, -1.75, '#39465c'], [-3, 1.75, '#b8bcc2']] as const) b.car(x, z, color, 0);
  for (const x of [-22, -12.5, -2.5]) b.pole(x, 2.75);
  for (const x of [-16.5, -7]) b.pole(x, -2.75);
  for (const [x, z] of [[-24, 2.95], [-20.4, 2.95], [-13, 2.95], [-11.9, 2.95], [-6, 2.95], [-17.5, -2.95], [-14, -2.95], [-3, -2.95], [-0.5, -2.95]] as const) b.pot(x, z);
  for (const [x, z] of [[-10, 2.85], [-23, -2.9], [-1.5, -2.9]] as const) b.weeds(x, z);

  // ---- 공원 (동쪽)
  b.park();

  // ---- 먹이 공간과 주민
  const foodStation = { x: 3.0, z: 2.75 };
  b.feedingShelter(foodStation.x, foodStation.z);

  // ---- 배경: 멀리 보이는 아파트 (이동 불가, 풍경용)
  b.backdropApartments();

  return {
    group: b.group,
    collision: { bounds: BOUNDS, rects: b.rects, circles: b.circles },
    interests: b.interests,
    occluders: b.occluders,
    spawn: { x: -6, z: 0.3, heading: Math.PI / 2 },
    foodStation,
    npcSpot: { x: 1.7, z: 2.6 },
  };
}

class Builder {
  readonly group = new THREE.Group();
  readonly rects: Rect[] = [];
  readonly circles: Circle[] = [];
  readonly interests: Interest[] = [];
  readonly occluders: THREE.Object3D[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private readonly rng: Rng) {}

  private mat(color: string, rough = 0.9): THREE.MeshStandardMaterial {
    const key = `${color}/${rough}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough });
      this.mats.set(key, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  private solidRect(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.rects.push({ minX, maxX, minZ, maxZ });
  }

  ground(): void {
    const asphalt = asphaltTexture();
    asphalt.repeat.set(50 / 3, 28 / 3);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(31, 28), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }));
    a.rotation.x = -Math.PI / 2;
    a.position.set(-26 + 15.5, 0, 0);
    a.receiveShadow = true;
    this.group.add(a);

    const grass = grassTexture();
    grass.repeat.set(10, 14);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(19, 28), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(5 + 9.5, 0.001, 0);
    g.receiveShadow = true;
    this.group.add(g);

    // 동네 바깥 땅 (지평선까지 이어지게)
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.mat('#8d8a80'));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.group.add(outer);
  }

  roadMarkings(): void {
    const white = this.mat('#e9e6dc', 0.7);
    for (const z of [-ROAD_HALF + 0.15, ROAD_HALF - 0.15]) this.flat(30, 0.1, white, -26 + 15, z);
    // 횡단보도 (참조 영상에서 본 생활 도로의 흰 줄무늬)
    for (let z = -2.0; z <= 2.0; z += 0.8) this.flat(0.45, 2.6, white, -17, z, Math.PI / 2);
    // 어린이 보호구역 같은 노면 글자는 넣지 않고, 정지선만
    this.flat(0.25, ROAD_HALF * 2 - 0.4, white, -18.8, 0, Math.PI / 2);
  }

  private flat(w: number, d: number, mat: THREE.Material, x: number, z: number, rotY = 0): void {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.set(-Math.PI / 2, 0, rotY);
    m.position.set(x, 0.004, z);
    m.receiveShadow = true;
    this.group.add(m);
  }

  /** 담장: 대문 자리(gaps)는 비워 둔다 */
  private wall(minX: number, maxX: number, side: 1 | -1, gaps: [number, number][] = []): void {
    const mat = this.mat('#b9b2a6');
    const cap = this.mat('#8f887c');
    const z = WALL_Z * side;
    const segs: [number, number][] = [];
    let cur = minX;
    for (const [g0, g1] of gaps) {
      if (g0 > cur) segs.push([cur, g0]);
      cur = g1;
    }
    if (cur < maxX) segs.push([cur, maxX]);
    for (const [a, c] of segs) {
      const w = c - a;
      const m = this.box(w, 1.3, 0.2, mat, (a + c) / 2, 0.65, z);
      this.box(w, 0.06, 0.26, cap, (a + c) / 2, 1.33, z);
      this.occluders.push(m);
      this.solidRect(a, c, z - 0.1, z + 0.1);
    }
  }

  private building(minX: number, maxX: number, side: 1 | -1, height: number, depth: number, mat: THREE.Material): void {
    const front = (WALL_Z + 0.6) * side;
    const back = front + depth * side;
    const z0 = Math.min(front, back);
    const z1 = Math.max(front, back);
    const m = this.box(maxX - minX, height, z1 - z0, mat, (minX + maxX) / 2, height / 2, (z0 + z1) / 2);
    this.occluders.push(m);
    this.solidRect(minX, maxX, z0, z1);
    // 옥상 방수 페인트 (초록) — 한국 주택 옥상의 흔한 모습
    this.box(maxX - minX - 0.2, 0.05, z1 - z0 - 0.2, this.mat('#5f8f6a'), (minX + maxX) / 2, height + 0.03, (z0 + z1) / 2, false);
  }

  villa(minX: number, maxX: number, side: 1 | -1, height: number, color: string): void {
    const tex = color === 'brick' ? brickTexture() : facadeTexture(color);
    const w = maxX - minX;
    tex.repeat.set(w / 3, height / 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    this.building(minX + 0.3, maxX - 0.3, side, height, 8, mat);
    this.wall(minX, maxX, side, [[minX + w * 0.35, minX + w * 0.35 + 1.4]]);
  }

  house(minX: number, maxX: number, side: 1 | -1, height: number, color: string): void {
    const tex = facadeTexture(color, '#f4f0e6');
    tex.repeat.set((maxX - minX) / 3.2, 1.3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    this.building(minX + 0.6, maxX - 0.6, side, height, 7, mat);
    this.wall(minX, maxX, side, []);
  }

  shop(minX: number, maxX: number, side: 1 | -1): void {
    const tex = facadeTexture('#f0ece2', '#ffffff');
    tex.repeat.set((maxX - minX) / 3, 1.2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const front = (WALL_Z - 0.2) * side;
    const depth = 6;
    const z0 = Math.min(front, front + depth * side);
    const z1 = Math.max(front, front + depth * side);
    const m = this.box(maxX - minX, 3.6, z1 - z0, mat, (minX + maxX) / 2, 1.8, (z0 + z1) / 2);
    this.occluders.push(m);
    this.solidRect(minX, maxX, z0, z1);
    // 줄무늬 차양
    const awning = this.box(maxX - minX - 0.4, 0.08, 1.0, this.mat('#3d7a5a'), (minX + maxX) / 2, 2.6, front - 0.45 * side);
    awning.rotation.x = 0.25 * side;
  }

  sideAlley(minX: number, maxX: number): void {
    // 양옆은 이웃 건물 벽, 끝에는 담장. 안쪽에 평상과 화분
    const mid = (minX + maxX) / 2;
    this.box(maxX - minX, 1.6, 0.2, this.mat('#b9b2a6'), mid, 0.8, BOUNDS.maxZ - 0.1);
    const deck = this.box(1.8, 0.38, 1.3, this.mat('#a0784e'), mid, 0.19, 10.5);
    this.occluders.push(deck);
    this.solidRect(mid - 0.9, mid + 0.9, 10.5 - 0.65, 10.5 + 0.65);
    this.interests.push({ kind: 'sunspot', x: mid, z: 9.4, r: 0.8 }, { kind: 'bench', x: mid, z: 9.5, r: 0.8 });
    this.pot(minX + 0.4, 6.5);
    this.pot(maxX - 0.4, 8.2);
    this.weeds(maxX - 0.35, 12.5);
    // 측면 건물 벽 (옆 필지 건물이 좁은 골목을 만든다)
    this.box(0.3, 8, BOUNDS.maxZ - WALL_Z, this.mat('#cfc8bb'), minX - 0.15, 4, (BOUNDS.maxZ + WALL_Z) / 2);
    this.box(0.3, 4.5, BOUNDS.maxZ - WALL_Z, this.mat('#d8cfba'), maxX + 0.15, 2.25, (BOUNDS.maxZ + WALL_Z) / 2);
    this.solidRect(minX - 0.3, minX, WALL_Z, BOUNDS.maxZ);
    this.solidRect(maxX, maxX + 0.3, WALL_Z, BOUNDS.maxZ);
  }

  parkingLot(minX: number, maxX: number): void {
    const white = this.mat('#e9e6dc', 0.7);
    for (let x = minX + 0.2; x <= maxX; x += 2.6) this.flat(0.1, 5, white, x, -8.5);
    this.car(minX + 1.5, -8.5, '#c9c9c9', Math.PI / 2);
    this.car(minX + 4.1, -8.6, '#7a2d2d', Math.PI / 2);
    this.box(maxX - minX, 1.5, 0.2, this.mat('#b9b2a6'), (minX + maxX) / 2, 0.75, BOUNDS.minZ + 0.1);
    this.interests.push({ kind: 'sunspot', x: maxX - 1, z: -5, r: 0.8 });
    this.weeds(maxX - 0.4, -11.5);
    // 양옆 담
    for (const x of [minX, maxX]) {
      this.box(0.2, 1.4, Math.abs(BOUNDS.minZ) - WALL_Z, this.mat('#b9b2a6'), x, 0.7, (BOUNDS.minZ - WALL_Z) / 2);
      this.solidRect(x - 0.1, x + 0.1, BOUNDS.minZ, -WALL_Z);
    }
  }

  emptyLot(minX: number, maxX: number): void {
    // 풀이 자란 작은 공터
    const g = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX - 0.4, 5), new THREE.MeshStandardMaterial({ color: '#7d9a55', roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set((minX + maxX) / 2, 0.003, -5.8);
    g.receiveShadow = true;
    this.group.add(g);
    for (let i = 0; i < 6; i++) this.weeds(range(this.rng, minX + 0.5, maxX - 0.5), range(this.rng, -8, -3.8));
    this.box(maxX - minX, 1.3, 0.2, this.mat('#b9b2a6'), (minX + maxX) / 2, 0.65, -8.5);
    this.solidRect(minX, maxX, -8.6, -8.4);
  }

  car(x: number, z: number, color: string, rotY: number): void {
    const g = new THREE.Group();
    const body = this.mat(color, 0.35);
    const glass = this.mat('#2a3440', 0.15);
    const tire = this.mat('#1d1d1f', 0.8);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(px, py, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(4.2, 0.7, 1.75), body, 0, 0.62, 0);
    add(new THREE.BoxGeometry(2.3, 0.62, 1.6), glass, -0.2, 1.27, 0);
    add(new THREE.BoxGeometry(2.1, 0.08, 1.5), body, -0.2, 1.6, 0);
    for (const [wx, wz] of [[1.35, 0.8], [1.35, -0.8], [-1.35, 0.8], [-1.35, -0.8]]) {
      const w = add(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16), tire, wx, 0.33, wz);
      w.rotation.x = Math.PI / 2;
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    this.group.add(g);
    this.occluders.push(g);
    const along = Math.abs(Math.sin(rotY)) > 0.5;
    const hx = along ? 0.9 : 2.1;
    const hz = along ? 2.1 : 0.9;
    this.solidRect(x - hx, x + hx, z - hz, z + hz);
    // 차 밑과 바퀴 주변은 고양이가 좋아하는 냄새 맡기 장소
    this.interests.push({ kind: 'car', x: x + (along ? 1.2 : 0), z: z + (along ? 0 : (z > 0 ? -1.2 : 1.2)), r: 0.6 });
  }

  pole(x: number, z: number): void {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 10), this.mat('#a7a39a'));
    m.position.set(x, 4, z);
    m.castShadow = true;
    this.group.add(m);
    this.box(1.2, 0.12, 0.12, this.mat('#7c776c'), x, 7.4, z);
    this.circles.push({ x, z, r: 0.17 });
  }

  pot(x: number, z: number): void {
    const terracotta = this.mat(this.rng() < 0.5 ? '#b9653f' : '#5d7d8c', 0.8);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 12), terracotta);
    p.position.set(x, 0.16, z);
    p.castShadow = p.receiveShadow = true;
    this.group.add(p);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), this.mat('#4f7d3a'));
    leaves.position.set(x, 0.45, z);
    leaves.scale.set(1, 0.8, 1);
    leaves.castShadow = true;
    this.group.add(leaves);
    const flowerColor = ['#e8508a', '#f2c84b', '#ffffff', '#d94a4a'][Math.floor(this.rng() * 4)];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.mat(flowerColor, 0.6));
      const a = (i / 5) * Math.PI * 2 + this.rng();
      f.position.set(x + Math.cos(a) * 0.16, 0.55 + this.rng() * 0.08, z + Math.sin(a) * 0.16);
      this.group.add(f);
    }
    this.circles.push({ x, z, r: 0.24 });
    this.interests.push({ kind: 'flower', x, z, r: 0.6 }, { kind: 'pot', x, z, r: 0.6 });
  }

  weeds(x: number, z: number): void {
    const mat = this.mat('#6e9244');
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22 + this.rng() * 0.18, 4), mat);
      blade.position.set(x + (this.rng() - 0.5) * 0.35, 0.12, z + (this.rng() - 0.5) * 0.3);
      blade.rotation.set((this.rng() - 0.5) * 0.5, 0, (this.rng() - 0.5) * 0.5);
      blade.castShadow = true;
      this.group.add(blade);
    }
    this.interests.push({ kind: 'grass', x, z, r: 0.5 });
  }

  park(): void {
    const x0 = 5;
    // 골목과의 경계: 낮은 산울타리, 가운데는 입구
    const hedge = this.mat('#4a7038');
    for (const [z0, z1] of [[ROAD_HALF, BOUNDS.maxZ], [BOUNDS.minZ, -ROAD_HALF]]) {
      const m = this.box(0.6, 0.7, z1 - z0, hedge, x0, 0.35, (z0 + z1) / 2);
      this.occluders.push(m);
      this.solidRect(x0 - 0.3, x0 + 0.3, z0, z1);
    }
    // 산책로
    const path = this.mat('#c9b997', 1);
    this.flat(14, 2.2, path, 12.5, 0);
    this.flat(2.2, 22, path, 13.5, 0);

    // 나무
    const trees: [number, number, number][] = [
      [8, 6, 1.3], [8.5, -7, 1.5], [11, 11, 1.4], [17, 10, 1.6], [21, 4, 1.3], [21.5, -10, 1.5], [10.5, -11.5, 1.2], [18.5, 2.5, 1.1],
    ];
    for (const [x, z, s] of trees) this.tree(x, z, s);

    // 벤치 (햇볕 드는 쉼터)
    this.bench(10.5, 1.7, 0);
    this.bench(15.2, 6, Math.PI / 2);
    this.bench(16.5, -2.0, 0);

    // 연못
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), new THREE.MeshStandardMaterial({ color: '#5f8fa6', roughness: 0.1, metalness: 0.1 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(18, 0.01, -7);
    this.group.add(pond);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.14, 8, 40), this.mat('#9b9488'));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(18, 0.06, -7);
    rim.receiveShadow = true;
    this.group.add(rim);
    this.circles.push({ x: 18, z: -7, r: 2.45 });
    this.interests.push({ kind: 'pond', x: 18, z: -7, r: 3.1 });

    // 화단
    this.flowerBed(9, 8.6, 3.2, 1.2);
    this.flowerBed(13.2, -10.5, 2.6, 1.2);
    this.flowerBed(20.5, 7.4, 1.6, 2.4);

    // 잔디밭 관심 지점과 햇볕 자리
    for (let i = 0; i < 10; i++) {
      this.interests.push({ kind: 'grass', x: range(this.rng, 6.5, 22.5), z: range(this.rng, -12.5, 12.5), r: 1 });
    }
    for (const [x, z] of [[9, 3.5], [19.5, 0.5], [12, -5], [17.5, 12]]) this.interests.push({ kind: 'sunspot', x, z, r: 1 });

    // 공원 바깥 담장
    const fence = this.mat('#7a6e5e');
    this.box(0.1, 1, BOUNDS.maxZ - BOUNDS.minZ, fence, BOUNDS.maxX, 0.5, 0);
    this.box(BOUNDS.maxX - x0, 1, 0.1, fence, (BOUNDS.maxX + x0) / 2, 0.5, BOUNDS.maxZ);
    this.box(BOUNDS.maxX - x0, 1, 0.1, fence, (BOUNDS.maxX + x0) / 2, 0.5, BOUNDS.minZ);
  }

  private tree(x: number, z: number, s: number): void {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 2.4 * s, 8), this.mat('#6b4f3a'));
    trunk.position.set(x, 1.2 * s, z);
    trunk.castShadow = trunk.receiveShadow = true;
    this.group.add(trunk);
    const greens = ['#4f7d3a', '#5d8c42', '#6a9a4b'];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(range(this.rng, 0.9, 1.3) * s, 1), this.mat(greens[i % 3]));
      c.position.set(x + range(this.rng, -0.6, 0.6) * s, (2.6 + range(this.rng, 0, 0.9)) * s, z + range(this.rng, -0.6, 0.6) * s);
      c.castShadow = true;
      c.receiveShadow = true;
      this.group.add(c);
    }
    this.circles.push({ x, z, r: 0.22 * s });
    this.interests.push({ kind: 'grass', x, z, r: 1.2 });
  }

  private bench(x: number, z: number, rotY: number): void {
    const g = new THREE.Group();
    const wood = this.mat('#a0744a');
    const iron = this.mat('#3b3b3b', 0.5);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.46), wood);
    seat.position.y = 0.44;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 0.05), wood);
    back.position.set(0, 0.72, -0.22);
    g.add(seat, back);
    for (const lx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.42), iron);
      leg.position.set(lx, 0.22, 0);
      g.add(leg);
    }
    g.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    this.group.add(g);
    const along = Math.abs(Math.sin(rotY)) > 0.5;
    const hx = along ? 0.28 : 0.88;
    const hz = along ? 0.88 : 0.28;
    this.solidRect(x - hx, x + hx, z - hz, z + hz);
    this.interests.push({ kind: 'bench', x, z: z + (along ? 0 : 0.6), r: 0.8 });
  }

  private flowerBed(x: number, z: number, w: number, d: number): void {
    this.box(w, 0.18, d, this.mat('#8b7d6b'), x, 0.09, z);
    const soil = this.box(w - 0.12, 0.02, d - 0.12, this.mat('#5b4636'), x, 0.19, z, false);
    soil.receiveShadow = true;
    const count = Math.floor(w * d * 14);
    const geo = new THREE.SphereGeometry(0.05, 8, 6);
    const colors = ['#e8508a', '#f06aa0', '#f2c84b', '#ffffff', '#c74e8f'];
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
    const leafInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.22, 4), this.mat('#5c8a3e'), count);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const fx = x + (this.rng() - 0.5) * (w - 0.2);
      const fz = z + (this.rng() - 0.5) * (d - 0.2);
      const fy = 0.32 + this.rng() * 0.1;
      m.makeTranslation(fx, fy, fz);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.set(colors[Math.floor(this.rng() * colors.length)]));
      m.makeTranslation(fx, 0.28, fz);
      leafInst.setMatrixAt(i, m);
    }
    inst.castShadow = leafInst.castShadow = true;
    this.group.add(inst, leafInst);
    this.solidRect(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    this.interests.push({ kind: 'flower', x, z, r: Math.max(w, d) / 2 + 0.5 });
  }

  feedingShelter(x: number, z: number): void {
    // 길고양이 급식소 같은 작은 나무 상자 (지붕 + 그릇)
    const wood = this.mat('#b08655');
    this.box(0.7, 0.05, 0.5, wood, x, 0.55, z + 0.15);
    this.box(0.05, 0.55, 0.5, wood, x - 0.33, 0.27, z + 0.15);
    this.box(0.05, 0.55, 0.5, wood, x + 0.33, 0.27, z + 0.15);
    this.box(0.7, 0.55, 0.05, wood, x, 0.27, z + 0.38);
    this.solidRect(x - 0.36, x + 0.36, z + 0.1, z + 0.42);
  }

  backdropApartments(): void {
    // 이동할 수 없는 먼 배경. 동네 너머로 아파트 단지가 보이게 한다.
    const tex = facadeTexture('#e4e1da', '#f6f4ef');
    for (const [x, z, h, w] of [[38, -18, 42, 14], [40, 6, 48, 14], [36, 28, 39, 12], [-45, 24, 45, 14], [-40, -26, 42, 16], [10, 38, 36, 14], [-14, -36, 40, 14]] as const) {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(w / 3, h / 3);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
      m.position.set(x, h / 2, z);
      m.lookAt(0, h / 2, 0);
      this.group.add(m);
    }
  }
}
