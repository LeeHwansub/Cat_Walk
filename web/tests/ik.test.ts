import { describe, expect, it } from 'vitest';
import { solveTwoBone } from '../src/cat/ik';

// 순운동학: 위쪽 뼈 각도 u, 무릎 각도 k (아래 방향 0, 앞쪽 +)
function fk(a: number, b: number, u: number, k: number) {
  const kneeZ = a * Math.sin(u);
  const kneeY = -a * Math.cos(u);
  return { z: kneeZ + b * Math.sin(u + k), y: kneeY - b * Math.cos(u + k) };
}

describe('solveTwoBone', () => {
  it('닿을 수 있는 목표에 정확히 닿는다', () => {
    for (const [dz, dy] of [[0, -0.18], [0.05, -0.15], [-0.06, -0.12], [0.1, -0.05]]) {
      for (const bend of [1, -1] as const) {
        const s = solveTwoBone(0.11, 0.105, dz, dy, bend);
        const p = fk(0.11, 0.105, s.upper, s.lower);
        expect(p.z).toBeCloseTo(dz, 4);
        expect(p.y).toBeCloseTo(dy, 4);
      }
    }
  });

  it('구부리는 방향이 반대면 무릎 각도 부호가 반대다', () => {
    const f = solveTwoBone(0.11, 0.105, 0, -0.15, 1);
    const h = solveTwoBone(0.11, 0.105, 0, -0.15, -1);
    expect(Math.sign(f.lower)).toBe(-Math.sign(h.lower));
  });

  it('닿지 않는 목표는 다리를 편 채 그 방향을 가리킨다', () => {
    const s = solveTwoBone(0.11, 0.105, 0, -1, 1);
    expect(s.upper).toBeCloseTo(0, 3);
    expect(Math.abs(s.lower)).toBeLessThan(0.05);
  });

  it('너무 가까운 목표에서도 NaN이 나오지 않는다', () => {
    const s = solveTwoBone(0.11, 0.105, 0, 0, 1);
    expect(Number.isFinite(s.upper)).toBe(true);
    expect(Number.isFinite(s.lower)).toBe(true);
  });
});
