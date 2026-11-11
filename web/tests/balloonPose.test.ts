import { describe, expect, it } from 'vitest';
import { balloonRound, floatPawTarget } from '../src/cat/balloonPose';

/** 왼쪽 앞다리 어깨 위치 예 (몸 기준 m, x 왼쪽 +, y 위, z 앞) */
const shoulderL = { x: 0.05, y: 0.16, z: 0.1 };
const hipR = { x: -0.06, y: 0.17, z: -0.1 };

describe('풍선으로 떠 있을 때 발 위치 (floatPawTarget)', () => {
  it('발이 어깨·엉덩이보다 바깥으로 벌어진다 (몸 밑에 모이지 않게)', () => {
    expect(floatPawTarget(shoulderL, true, 0).x).toBeGreaterThan(shoulderL.x + 0.03);
    expect(floatPawTarget(hipR, false, 0).x).toBeLessThan(hipR.x - 0.03);
  });

  it('앞발은 앞으로, 뒷발은 뒤로 뻗는다', () => {
    expect(floatPawTarget(shoulderL, true, 0).z).toBeGreaterThan(shoulderL.z);
    expect(floatPawTarget(hipR, false, 0).z).toBeLessThan(hipR.z);
  });

  it('발은 어깨보다 아래, 다리 길이(약 12cm) 안쪽 (다리가 일자로 뻗지 않게)', () => {
    for (const t of [0, 0.4, 1.3]) {
      const p = floatPawTarget(shoulderL, true, t);
      expect(p.y).toBeLessThan(shoulderL.y);
      const d = Math.hypot(p.x - shoulderL.x, p.y - shoulderL.y, p.z - shoulderL.z);
      expect(d).toBeLessThan(0.12);
    }
  });

  it('시간에 따라 허우적거린다', () => {
    const a = floatPawTarget(shoulderL, true, 0);
    const b = floatPawTarget(shoulderL, true, 0.7);
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.01);
  });
});

describe('풍선 몸 둥글기 (balloonRound)', () => {
  it('떠 있지 않으면 0, 다 떠오르면 강하게 둥글게', () => {
    expect(balloonRound(0)).toBe(0);
    expect(balloonRound(1)).toBeGreaterThan(0.5);
    expect(balloonRound(1)).toBeLessThanOrEqual(1);
    expect(balloonRound(0.5)).toBeLessThan(balloonRound(1));
  });
});
