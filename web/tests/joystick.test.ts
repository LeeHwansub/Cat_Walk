import { describe, expect, it } from 'vitest';
import { RUN_PUSH, stickVector } from '../src/ui/joystick';

describe('가상 조이스틱 (모바일)', () => {
  it('가운데 근처(데드존)는 움직이지 않는다', () => {
    expect(stickVector(3, -2, 60)).toEqual({ x: 0, z: 0, mag: 0 });
  });

  it('위로 밀면 앞(+z), 오른쪽으로 밀면 오른쪽(+x)', () => {
    const up = stickVector(0, -60, 60);
    expect(up.z).toBeCloseTo(1);
    expect(up.x).toBeCloseTo(0);
    const right = stickVector(60, 0, 60);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('반지름 밖으로 끌어도 크기는 1을 넘지 않는다', () => {
    const v = stickVector(200, -200, 60);
    expect(v.mag).toBeCloseTo(1);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });

  it('반쯤 밀면 크기도 반쯤 (데드존만큼 보정)', () => {
    const v = stickVector(0, -30, 60);
    expect(v.mag).toBeGreaterThan(0.35);
    expect(v.mag).toBeLessThan(0.55);
  });

  it('끝까지 밀어야 달리기 크기에 닿는다', () => {
    expect(stickVector(0, -40, 60).mag).toBeLessThan(RUN_PUSH);
    expect(stickVector(0, -60, 60).mag).toBeGreaterThanOrEqual(RUN_PUSH);
  });
});
