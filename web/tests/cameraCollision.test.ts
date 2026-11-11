import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bodyFade, CAM_PROBE, clearDistance, nextDistance } from '../src/camera/collision';

/** 카메라 뒤쪽(−z)에 놓인 벽 하나 */
function wall(z: number, x = 0, width = 4): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, 3, 0.2), new THREE.MeshBasicMaterial());
  m.position.set(x, 1.5, z);
  m.updateMatrixWorld(true);
  return m;
}

const target = new THREE.Vector3(0, 0.3, 0);
const back = new THREE.Vector3(0, 0, -1);
const ray = new THREE.Raycaster();

describe('카메라 벽 충돌 (clearDistance)', () => {
  it('막는 물체가 없으면 원하는 거리 그대로', () => {
    expect(clearDistance(ray, target, back, 1.7, [])).toBeCloseTo(1.7, 6);
  });

  it('뒤에 벽이 있으면 벽 앞(여유 거리만큼 앞)까지 당긴다', () => {
    // 벽 앞면은 z = −0.9
    const d = clearDistance(ray, target, back, 1.7, [wall(-1.0)]);
    expect(d).toBeCloseTo(0.9 - CAM_PROBE.pad, 3);
  });

  it('가운데 선은 비껴가도 화면 가장자리가 벽에 걸리면 당긴다 (지금까지는 놓쳤음)', () => {
    // 벽 끝이 가운데 선에서 3cm 옆: 가운데 선 한 줄로는 안 걸린다
    const edge = wall(-1.0, 2.0 + 0.03, 4);
    expect(new THREE.Raycaster(target, back, 0, 1.7).intersectObject(edge).length).toBe(0);
    expect(clearDistance(ray, target, back, 1.7, [edge])).toBeLessThan(0.9);
  });

  it('벽이 아주 가까워도 최소 거리보다 가까이 오지는 않는다', () => {
    expect(clearDistance(ray, target, back, 1.7, [wall(-0.2)])).toBeCloseTo(CAM_PROBE.minDist, 6);
  });

  it('고양이 크기에 따라 최소 거리가 줄어든다', () => {
    expect(clearDistance(ray, target, back, 1.0, [wall(-0.2)], 0.5)).toBeCloseTo(CAM_PROBE.minDist * 0.5, 6);
  });
});

describe('카메라 거리 부드럽게 (nextDistance)', () => {
  it('벽에 막히면 바로 당긴다 (한 프레임도 벽 속에 있지 않게)', () => {
    expect(nextDistance(1.7, 0.6, 1 / 60)).toBe(0.6);
  });

  it('막힘이 풀리면 천천히 원래 거리로 돌아간다', () => {
    const d = nextDistance(0.6, 1.7, 0.1);
    expect(d).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(0.6 + (1.7 - 0.6) * 0.5);
  });

  it('충분한 시간이 지나면 원래 거리에 도달한다', () => {
    let d = 0.6;
    for (let i = 0; i < 300; i++) d = nextDistance(d, 1.7, 1 / 60);
    expect(d).toBeCloseTo(1.7, 2);
  });
});

describe('카메라가 가까울 때 고양이 흐리게 (bodyFade)', () => {
  it('보통 거리에서는 완전히 보인다', () => {
    expect(bodyFade(0.7, 1)).toBe(1);
    expect(bodyFade(1.7, 1)).toBe(1);
  });

  it('최소 거리까지 붙으면 보이지 않는다 (몸 속이 보이지 않게)', () => {
    expect(bodyFade(CAM_PROBE.minDist, 1)).toBe(0);
  });

  it('가까워질수록 점점 흐려진다', () => {
    expect(bodyFade(0.3, 1)).toBeGreaterThan(bodyFade(0.22, 1));
    expect(bodyFade(0.3, 1)).toBeLessThan(1);
  });

  it('고양이 크기에 비례한다', () => {
    expect(bodyFade(0.15, 0.5)).toBeCloseTo(bodyFade(0.3, 1), 6);
  });
});
