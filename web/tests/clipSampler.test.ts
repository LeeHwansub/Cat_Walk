import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ClipSampler } from '../src/cat/clipSampler';

function setup() {
  const a = new THREE.Bone();
  a.name = 'leg.upper_01'; // 원본 이름에 점이 있어도 (GLTFLoader는 점을 지운 이름으로 트랙을 만든다)
  const b = new THREE.Bone();
  b.name = 'no_track';
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1);
  const clip = new THREE.AnimationClip('walk', 1, [
    new THREE.QuaternionKeyframeTrack('legupper_01.quaternion', [0, 1], [0, 0, 0, 1, ...q1.toArray()]),
    new THREE.VectorKeyframeTrack('legupper_01.position', [0, 1], [0, 0, 0, 0, 2, 0]),
  ]);
  return { a, b, q1, clip };
}

describe('ClipSampler (클립 값을 직접 계산)', () => {
  it('트랙이 있는 뼈는 그 시점의 회전·위치를 돌려준다', () => {
    const { a, b, q1, clip } = setup();
    const s = new ClipSampler(clip, [a, b]);
    s.sample(1);
    expect(s.hasQ[0]).toBe(true);
    expect(s.q[0].angleTo(q1)).toBeLessThan(1e-6);
    expect(s.p[0].y).toBeCloseTo(2);
    s.sample(0.5);
    expect(s.q[0].angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5))).toBeLessThan(1e-4);
  });

  it('트랙이 없는 뼈는 표시해 둔다 (코드 자세를 그대로 쓰게)', () => {
    const { a, b, clip } = setup();
    const s = new ClipSampler(clip, [a, b]);
    s.sample(0.3);
    expect(s.hasQ[1]).toBe(false);
    expect(s.hasP[1]).toBe(false);
  });

  it('같은 시점을 여러 번 물어도 같은 값 (멈춰서 걸음 위상이 그대로여도)', () => {
    const { a, b, clip } = setup();
    const s = new ClipSampler(clip, [a, b]);
    s.sample(0.3);
    const first = s.q[0].clone();
    a.quaternion.set(0.3, 0.2, 0.1, 0.9).normalize(); // 뼈 값이 바뀌어도 영향 없음
    s.sample(0.3);
    expect(s.q[0].angleTo(first)).toBeLessThan(1e-6);
  });

  it('뼈 값을 건드리지 않는다', () => {
    const { a, b, clip } = setup();
    const before = a.quaternion.clone();
    new ClipSampler(clip, [a, b]).sample(0.7);
    expect(a.quaternion.equals(before)).toBe(true);
  });
});
