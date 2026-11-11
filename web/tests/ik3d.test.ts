import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { solveTwoBoneIK } from '../src/cat/ik3d';

/** 엉덩이(a) → 무릎(b) → 발(c). 무릎이 앞(+z)으로 살짝 굽은 기준 자세 */
function chain(): { root: THREE.Group; a: THREE.Object3D; b: THREE.Object3D; c: THREE.Object3D } {
  const root = new THREE.Group();
  const a = new THREE.Object3D();
  const b = new THREE.Object3D();
  const c = new THREE.Object3D();
  a.position.set(0, 1, 0);
  b.position.set(0, -0.5, 0.1);
  c.position.set(0, -0.5, -0.1);
  root.add(a);
  a.add(b);
  b.add(c);
  root.updateMatrixWorld(true);
  return { root, a, b, c };
}

const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('solveTwoBoneIK', () => {
  it('닿는 목표면 끝(발)이 목표에 놓인다', () => {
    for (const t of [new THREE.Vector3(0, 0.3, 0.2), new THREE.Vector3(0.1, 0.5, -0.3), new THREE.Vector3(0, 0.1, 0)]) {
      const { a, b, c } = chain();
      solveTwoBoneIK(a, b, c, t, new THREE.Vector3(1, 0, 0));
      expect(world(c).distanceTo(t)).toBeLessThan(1e-3);
    }
  });

  it('뼈 길이는 바뀌지 않는다', () => {
    const { a, b, c } = chain();
    const lab = world(a).distanceTo(world(b));
    const lbc = world(b).distanceTo(world(c));
    solveTwoBoneIK(a, b, c, new THREE.Vector3(0, 0.4, 0.3), new THREE.Vector3(1, 0, 0));
    expect(world(a).distanceTo(world(b))).toBeCloseTo(lab, 5);
    expect(world(b).distanceTo(world(c))).toBeCloseTo(lbc, 5);
  });

  it('너무 멀면 목표 쪽으로 곧게 편다', () => {
    const { a, c } = chain();
    const t = new THREE.Vector3(0, -2, 0);
    solveTwoBoneIK(a, a.children[0], c, t, new THREE.Vector3(1, 0, 0));
    const dir = world(c).sub(world(a)).normalize();
    expect(dir.y).toBeLessThan(-0.99);
  });

  it('무릎은 기준 자세와 같은 쪽(앞)으로 굽는다', () => {
    const { a, b, c } = chain();
    solveTwoBoneIK(a, b, c, new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(1, 0, 0));
    expect(world(b).z).toBeGreaterThan(0.05);
  });

  it('부모가 회전·확대되어 있어도 목표에 닿는다', () => {
    const { root, a, b, c } = chain();
    root.rotation.set(0.3, 0.8, -0.2);
    root.scale.setScalar(2);
    root.updateMatrixWorld(true);
    const t = world(a).add(new THREE.Vector3(0.2, -1.2, 0.5));
    solveTwoBoneIK(a, b, c, t, new THREE.Vector3(1, 0, 0));
    expect(world(c).distanceTo(t)).toBeLessThan(2e-3);
  });
});
