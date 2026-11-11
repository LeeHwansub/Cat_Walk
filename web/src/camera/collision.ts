import * as THREE from 'three';

/**
 * 3인칭 카메라가 벽을 뚫지 않게 하는 값 (m, 성체 기준).
 * - radius: 검사 굵기. 3인칭 카메라 앞 잘림면(near 0.05, 화각 50°)의 반대각선(가로로 긴 화면에서 약 5.6cm)보다 크게.
 *   가운데 선 한 줄만 보면 화면 가장자리가 벽 속으로 들어간다
 * - pad: 벽에서 띄우는 거리. 앞 잘림면(0.05)보다 넉넉히
 * - minDist: 고양이에게 이보다 가까이 오지 않는다. 이보다 가까운 고양이 몸은 셰이더가 숨긴다 (bodyNearCut)
 */
export const CAM_PROBE = { radius: 0.06, pad: 0.1, minDist: 0.15 };

/** 막혔다가 풀릴 때 원래 거리로 돌아가는 빠르기 (클수록 빠름) */
const RETURN_RATE = 3;

const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpOrigin = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * target(고양이 눈높이)에서 dir(단위 벡터) 쪽으로 카메라를 want만큼 보낼 때, 벽에 박히지 않는 거리.
 * 가운데 + 위아래·좌우로 radius만큼 옮긴 선 다섯 줄로 검사한다 (굵은 선으로 검사하는 셈).
 * scale: 고양이 크기 배율 (최소 거리에 곱한다)
 */
export function clearDistance(
  raycaster: THREE.Raycaster,
  target: THREE.Vector3,
  dir: THREE.Vector3,
  want: number,
  occluders: THREE.Object3D[],
  scale = 1,
): number {
  const minDist = CAM_PROBE.minDist * scale;
  if (occluders.length === 0) return Math.max(minDist, want);
  tmpRight.crossVectors(dir, WORLD_UP);
  if (tmpRight.lengthSq() < 1e-6) tmpRight.set(1, 0, 0);
  tmpRight.normalize();
  tmpUp.crossVectors(tmpRight, dir).normalize();
  const r = CAM_PROBE.radius;
  let best = want;
  for (const [a, b] of [
    [0, 0],
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ]) {
    tmpOrigin.copy(target).addScaledVector(tmpRight, a).addScaledVector(tmpUp, b);
    raycaster.set(tmpOrigin, dir);
    raycaster.near = 0;
    raycaster.far = want + CAM_PROBE.pad;
    const hit = raycaster.intersectObjects(occluders, true)[0];
    if (hit) best = Math.min(best, hit.distance - CAM_PROBE.pad);
  }
  return THREE.MathUtils.clamp(best, minDist, Math.max(minDist, want));
}

/**
 * 카메라가 고양이에 가까워지면 고양이 전체를 점무늬로 흐리게 한다 (1 = 다 보임, 0 = 안 보임).
 * 벽에 막혀 바짝 붙었을 때 몸 속이 보이지 않게. 보통 거리(0.7m 이상)에서는 1
 */
export function bodyFade(camDist: number, scale = 1): number {
  return THREE.MathUtils.smoothstep(camDist, 0.17 * scale, 0.45 * scale);
}

/**
 * 카메라 거리 부드럽게: 막히면 그 프레임에 바로 당기고(벽 속이 한 프레임도 보이지 않게),
 * 풀리면 천천히 돌아간다(덜컥거리지 않게)
 */
export function nextDistance(current: number, allowed: number, dt: number): number {
  if (allowed <= current) return allowed;
  return current + (allowed - current) * (1 - Math.exp(-RETURN_RATE * dt));
}
