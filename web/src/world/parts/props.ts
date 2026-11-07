import * as THREE from 'three';
import { range } from '../../core/rng';
import type { MapKit } from './kit';

/** 소품 부품: 차, 전봇대, 화분, 잡초, 나무, 벤치, 화단, 먹이 쉼터 */

/** 승용차. 차 밑과 바퀴 주변은 고양이가 좋아하는 냄새 맡기 장소 */
export function car(k: MapKit, x: number, z: number, color: string, rotY: number): void {
  const g = new THREE.Group();
  const body = k.mat(color, 0.35);
  const glass = k.mat('#2a3440', 0.15);
  const tire = k.mat('#1d1d1f', 0.8);
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
  k.group.add(g);
  k.occluders.push(g);
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  const hx = along ? 0.9 : 2.1;
  const hz = along ? 2.1 : 0.9;
  k.solidRect(x - hx, x + hx, z - hz, z + hz);
  k.interests.push({ kind: 'car', x: x + (along ? 1.2 : 0), z: z + (along ? 0 : z > 0 ? -1.2 : 1.2), r: 0.6 });
}

export function pole(k: MapKit, x: number, z: number): void {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 10), k.mat('#a7a39a'));
  m.position.set(x, 4, z);
  m.castShadow = true;
  k.group.add(m);
  k.box(1.2, 0.12, 0.12, k.mat('#7c776c'), x, 7.4, z);
  k.circles.push({ x, z, r: 0.17 });
}

export function pot(k: MapKit, x: number, z: number): void {
  const terracotta = k.mat(k.rng() < 0.5 ? '#b9653f' : '#5d7d8c', 0.8);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 12), terracotta);
  p.position.set(x, 0.16, z);
  p.castShadow = p.receiveShadow = true;
  k.group.add(p);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), k.mat('#4f7d3a'));
  leaves.position.set(x, 0.45, z);
  leaves.scale.set(1, 0.8, 1);
  leaves.castShadow = true;
  k.group.add(leaves);
  const flowerColor = ['#e8508a', '#f2c84b', '#ffffff', '#d94a4a'][Math.floor(k.rng() * 4)];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), k.mat(flowerColor, 0.6));
    const a = (i / 5) * Math.PI * 2 + k.rng();
    f.position.set(x + Math.cos(a) * 0.16, 0.55 + k.rng() * 0.08, z + Math.sin(a) * 0.16);
    k.group.add(f);
  }
  k.circles.push({ x, z, r: 0.24 });
  k.interests.push({ kind: 'flower', x, z, r: 0.6 }, { kind: 'pot', x, z, r: 0.6 });
}

export function weeds(k: MapKit, x: number, z: number): void {
  const mat = k.mat('#6e9244');
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22 + k.rng() * 0.18, 4), mat);
    blade.position.set(x + (k.rng() - 0.5) * 0.35, 0.12, z + (k.rng() - 0.5) * 0.3);
    blade.rotation.set((k.rng() - 0.5) * 0.5, 0, (k.rng() - 0.5) * 0.5);
    blade.castShadow = true;
    k.group.add(blade);
  }
  k.interests.push({ kind: 'grass', x, z, r: 0.5 });
}

export function tree(k: MapKit, x: number, z: number, s: number): void {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 2.4 * s, 8), k.mat('#6b4f3a'));
  trunk.position.set(x, 1.2 * s, z);
  trunk.castShadow = trunk.receiveShadow = true;
  k.group.add(trunk);
  const greens = ['#4f7d3a', '#5d8c42', '#6a9a4b'];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(range(k.rng, 0.9, 1.3) * s, 1), k.mat(greens[i % 3]));
    c.position.set(x + range(k.rng, -0.6, 0.6) * s, (2.6 + range(k.rng, 0, 0.9)) * s, z + range(k.rng, -0.6, 0.6) * s);
    c.castShadow = true;
    c.receiveShadow = true;
    k.group.add(c);
  }
  k.circles.push({ x, z, r: 0.22 * s });
  k.interests.push({ kind: 'grass', x, z, r: 1.2 });
}

export function bench(k: MapKit, x: number, z: number, rotY: number): void {
  const g = new THREE.Group();
  const wood = k.mat('#a0744a');
  const iron = k.mat('#3b3b3b', 0.5);
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
  k.group.add(g);
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  const hx = along ? 0.28 : 0.88;
  const hz = along ? 0.88 : 0.28;
  k.solidRect(x - hx, x + hx, z - hz, z + hz);
  k.interests.push({ kind: 'bench', x, z: z + (along ? 0 : 0.6), r: 0.8 });
}

export function flowerBed(k: MapKit, x: number, z: number, w: number, d: number): void {
  k.box(w, 0.18, d, k.mat('#8b7d6b'), x, 0.09, z);
  const soil = k.box(w - 0.12, 0.02, d - 0.12, k.mat('#5b4636'), x, 0.19, z, false);
  soil.receiveShadow = true;
  const count = Math.floor(w * d * 14);
  const geo = new THREE.SphereGeometry(0.05, 8, 6);
  const colors = ['#e8508a', '#f06aa0', '#f2c84b', '#ffffff', '#c74e8f'];
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
  const leafInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.22, 4), k.mat('#5c8a3e'), count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const fx = x + (k.rng() - 0.5) * (w - 0.2);
    const fz = z + (k.rng() - 0.5) * (d - 0.2);
    const fy = 0.32 + k.rng() * 0.1;
    m.makeTranslation(fx, fy, fz);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.set(colors[Math.floor(k.rng() * colors.length)]));
    m.makeTranslation(fx, 0.28, fz);
    leafInst.setMatrixAt(i, m);
  }
  inst.castShadow = leafInst.castShadow = true;
  k.group.add(inst, leafInst);
  k.solidRect(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  k.interests.push({ kind: 'flower', x, z, r: Math.max(w, d) / 2 + 0.5 });
}

/** 길고양이 급식소 같은 작은 나무 상자 (지붕 + 그릇 자리) */
export function feedingShelter(k: MapKit, x: number, z: number): void {
  const wood = k.mat('#b08655');
  k.box(0.7, 0.05, 0.5, wood, x, 0.55, z + 0.15);
  k.box(0.05, 0.55, 0.5, wood, x - 0.33, 0.27, z + 0.15);
  k.box(0.05, 0.55, 0.5, wood, x + 0.33, 0.27, z + 0.15);
  k.box(0.7, 0.55, 0.05, wood, x, 0.27, z + 0.38);
  k.solidRect(x - 0.36, x + 0.36, z + 0.1, z + 0.42);
}
