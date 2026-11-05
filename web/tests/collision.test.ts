import { describe, expect, it } from 'vitest';
import { isFree, resolveCircle, type CollisionWorld } from '../src/world/collision';

const world: CollisionWorld = {
  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  rects: [{ minX: 0, maxX: 2, minZ: 0, maxZ: 2 }],
  circles: [{ x: -5, z: -5, r: 1 }],
};

describe('collision', () => {
  it('장애물 밖에서는 위치가 바뀌지 않는다', () => {
    expect(resolveCircle(world, 5, 5, 0.2)).toEqual({ x: 5, z: 5 });
  });

  it('사각형 안으로 들어가면 가장 가까운 바깥으로 밀려난다', () => {
    const p = resolveCircle(world, 0.1, 1, 0.2);
    expect(p.x).toBeCloseTo(-0.2);
    expect(p.z).toBeCloseTo(1);
  });

  it('사각형 모서리에 겹치면 밀려난다', () => {
    const p = resolveCircle(world, 2.1, 2.1, 0.2);
    expect(isFree(world, p.x, p.z, 0.2)).toBe(true);
  });

  it('원형 장애물에서 밀려난다', () => {
    const p = resolveCircle(world, -5.5, -5, 0.2);
    expect(Math.hypot(p.x + 5, p.z + 5)).toBeCloseTo(1.2);
  });

  it('월드 경계 밖으로 나가지 않는다', () => {
    expect(resolveCircle(world, 50, -50, 0.2)).toEqual({ x: 9.8, z: -9.8 });
  });

  it('isFree는 겹침 여부를 알려 준다', () => {
    expect(isFree(world, 1, 1, 0.1)).toBe(false);
    expect(isFree(world, 5, 5, 0.1)).toBe(true);
  });
});
