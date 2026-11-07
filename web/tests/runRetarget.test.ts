import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ClipRetarget, RUN_ALIGN } from '../src/cat/retarget';

/** 원본 뼈 하나('pelvis')와, 원본 앞 방향(+X) 축으로 0 → angle 도는 동작 */
function source(angle: number, lift = 0): { scene: THREE.Group; clip: THREE.AnimationClip } {
  const scene = new THREE.Group();
  const pelvis = new THREE.Object3D();
  pelvis.name = 'pelvis';
  pelvis.position.set(0, 0.2, 0);
  scene.add(pelvis);
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
  const clip = new THREE.AnimationClip('run', 1, [
    new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, ...q1.toArray()]),
    new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [0, 0.2, 0, 0, 0.2 + lift, 0]),
  ]);
  return { scene, clip };
}

describe('ClipRetarget (다른 뼈대 동작 옮기기)', () => {
  it('원본이 기준 자세면 회전 차이가 없다', () => {
    const { scene, clip } = source(0.6);
    const r = new ClipRetarget(scene, clip, [['pelvis', 'torso_02']]);
    const out = new Map<string, THREE.Quaternion>();
    r.sample(0, out);
    expect(out.get('torso_02')!.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
  });

  it('원본 앞 방향(+X) 축 회전은 대상 앞 방향(+Z) 축 회전으로 옮겨진다', () => {
    const { scene, clip } = source(0.6);
    const r = new ClipRetarget(scene, clip, [['pelvis', 'torso_02']]);
    const out = new Map<string, THREE.Quaternion>();
    r.sample(1, out);
    const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.6);
    expect(out.get('torso_02')!.angleTo(want)).toBeLessThan(1e-4);
  });

  it('좌표 맞춤: 원본 앞(+X)은 대상 앞(+Z), 원본 왼쪽(−Z)은 대상 왼쪽(+X)', () => {
    expect(new THREE.Vector3(1, 0, 0).applyQuaternion(RUN_ALIGN).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
    expect(new THREE.Vector3(0, 0, -1).applyQuaternion(RUN_ALIGN).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-6);
  });

  it('골반 높이 변화를 돌려준다', () => {
    const { scene, clip } = source(0, 0.03);
    const r = new ClipRetarget(scene, clip, [['pelvis', 'torso_02']]);
    expect(r.sample(1, new Map())).toBeCloseTo(0.03, 5);
    expect(r.sample(0, new Map())).toBeCloseTo(0, 5);
  });

  it('원본에 없는 뼈를 짝지으면 알려 준다', () => {
    const { scene, clip } = source(0);
    expect(() => new ClipRetarget(scene, clip, [['nope', 'torso_02']])).toThrow();
  });
});
