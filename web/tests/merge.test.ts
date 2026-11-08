import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeStatic } from '../src/world/merge';

function meshes(o: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  o.traverse((x) => {
    if ((x as THREE.Mesh).isMesh) out.push(x as THREE.Mesh);
  });
  return out;
}

function worldBox(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

function scene() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 'red' });
  const blue = new THREE.MeshStandardMaterial({ color: 'blue' });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, cast = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, 1, 0);
    mesh.rotation.y = x * 0.3;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(1, 1, 1), red, 0);
  add(new THREE.IcosahedronGeometry(0.5, 1), red, 2); // 인덱스 없는 도형도 섞인다
  add(new THREE.BoxGeometry(1, 2, 1), red, 4);
  add(new THREE.BoxGeometry(1, 1, 1), blue, 6);
  add(new THREE.BoxGeometry(1, 1, 1), blue, 8);
  add(new THREE.BoxGeometry(1, 1, 1), red, 10, false); // 그림자 설정이 다르면 따로
  const keep = add(new THREE.BoxGeometry(3, 3, 3), red, 12); // 카메라 가림 물체 (합치지 않음)
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), red, 3);
  g.add(inst);
  return { g, red, blue, keep, inst };
}

describe('mergeStatic (구역 안 정적 물체 합치기)', () => {
  it('같은 재질·그림자 설정끼리 하나로 합쳐 그리기 호출을 줄인다', () => {
    const { g, keep } = scene();
    const before = meshes(g).length;
    mergeStatic(g, new Set([keep]));
    const after = meshes(g);
    // red(3개) → 1, blue(2개) → 1, 그림자 다른 red 1, 가림 물체 1, 인스턴스 1
    expect(before).toBe(8);
    expect(after.length).toBe(5);
  });

  it('합쳐도 모양(정점 수와 전체 범위)이 그대로다', () => {
    const a = scene();
    const b = scene();
    const count = (o: THREE.Object3D) =>
      meshes(o)
        .filter((m) => !(m as THREE.InstancedMesh).isInstancedMesh)
        .reduce((s, m) => s + m.geometry.getAttribute('position').count * (m.geometry.index ? 0 : 1) + (m.geometry.index?.count ?? 0), 0);
    const before = count(a.g);
    mergeStatic(b.g, new Set([b.keep]));
    expect(count(b.g)).toBe(before);
    const boxA = worldBox(a.g);
    const boxB = worldBox(b.g);
    expect(boxB.min.distanceTo(boxA.min)).toBeLessThan(1e-5);
    expect(boxB.max.distanceTo(boxA.max)).toBeLessThan(1e-5);
  });

  it('제외한 물체(카메라 가림)와 인스턴스 메시는 그대로 둔다', () => {
    const { g, keep, inst } = scene();
    mergeStatic(g, new Set([keep]));
    expect(keep.parent).toBe(g);
    expect(inst.parent).toBe(g);
  });

  it('합친 메시는 원래 재질과 그림자 설정을 유지한다', () => {
    const { g, keep, blue } = scene();
    mergeStatic(g, new Set([keep]));
    const blues = meshes(g).filter((m) => m.material === blue);
    expect(blues.length).toBe(1);
    expect(blues[0].castShadow).toBe(true);
    expect(blues[0].receiveShadow).toBe(true);
  });

  it('제외한 그룹의 자식도 합치지 않는다', () => {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial();
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(), red), new THREE.Mesh(new THREE.BoxGeometry(), red));
    g.add(car, new THREE.Mesh(new THREE.BoxGeometry(), red), new THREE.Mesh(new THREE.BoxGeometry(), red));
    mergeStatic(g, new Set([car]));
    expect(car.children.length).toBe(2);
    expect(meshes(g).length).toBe(3);
  });

  it('투명 재질은 합치지 않지만, 합쳐도 된다고 표시한 투명 재질(같은 판 여러 장)은 합친다', () => {
    const g = new THREE.Group();
    const plain = new THREE.MeshStandardMaterial({ transparent: true });
    const decal = new THREE.MeshStandardMaterial({ transparent: true });
    decal.userData.mergeable = true;
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), plain);
      a.position.x = i;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), decal);
      b.position.x = i;
      g.add(a, b);
    }
    expect(mergeStatic(g, new Set())).toBe(2);
    expect(g.children.filter((c) => (c as THREE.Mesh).material === plain)).toHaveLength(3);
    expect(g.children.filter((c) => (c as THREE.Mesh).material === decal)).toHaveLength(1);
  });
});

