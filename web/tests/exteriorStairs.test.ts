import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { groundAt, isFree, pathClear } from '../src/world/collision';

// 지도의 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다). Node에는 document가 없다
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

const dt = 1 / 60;
const world = buildNeighborhood().collision;
/** 계단 가운데 줄 (옆 골목 서쪽 벽 x −18.5 ~ 난간 −17.6) */
const STAIR_X = -18.05;

function catAt(x: number, z: number, y = 0, heading = 0) {
  const c = new CatController(world, 0.4);
  c.x = x;
  c.z = z;
  c.y = y;
  c.heading = heading;
  return c;
}

describe('벽돌 빌라 외부 계단 (J-4)', () => {
  it('큰길 쪽 입구에서 걸어 올라가 2층 현관 앞(3.0m)에 선다', () => {
    const c = catAt(STAIR_X, 3.6);
    for (let i = 0; i < 60 * 14 && c.z < 9.3; i++) c.moveDirect(0, 1, dt);
    for (let i = 0; i < 30; i++) c.brake(dt);
    expect(c.z).toBeGreaterThan(8.8);
    expect(c.y).toBeCloseTo(3.0, 1);
    expect(c.jumping).toBe(false);
  });

  it('다시 걸어 내려와 바닥에 선다', () => {
    const c = catAt(STAIR_X, 9.3, 3.0, Math.PI);
    for (let i = 0; i < 60 * 14 && c.z > 3.6; i++) c.moveDirect(0, -1, dt);
    for (let i = 0; i < 30; i++) c.brake(dt);
    expect(c.z).toBeLessThan(4.0);
    expect(c.y).toBeCloseTo(0, 2);
  });

  it('계단 중간에서 골목 쪽으로 밀어도 난간에 막혀 떨어지거나 뛰어내리지 않는다', () => {
    const c = catAt(STAIR_X, 6.5);
    c.y = groundAt(world, c.x, c.z, 5);
    const y0 = c.y;
    expect(y0).toBeGreaterThan(1);
    for (let i = 0; i < 120; i++) c.moveDirect(1, 0, dt);
    expect(c.jumping).toBe(false);
    expect(c.x).toBeLessThan(-17.6);
    expect(Math.abs(c.y - y0)).toBeLessThan(0.2);
  });

  it('계단 칸 높이는 턱(0.2m)보다 낮고, 현관 바닥은 3.0m', () => {
    let prev = 0;
    for (let z = 3.6; z < 8.7; z += 0.05) {
      const g = groundAt(world, STAIR_X, z, prev + 0.2);
      expect(g - prev).toBeLessThanOrEqual(0.2);
      prev = g;
    }
    expect(groundAt(world, STAIR_X, 9.3, 3.1)).toBeCloseTo(3.0);
  });

  it('옆 골목은 계단 옆으로 지나갈 수 있고, 평상(0.38)은 현관 뒤로 옮겨 양옆으로 돌아갈 수 있다', () => {
    expect(pathClear(world, -16.6, 3.6, -16.6, 11.3, 0.18)).toBe(true);
    expect(groundAt(world, -17, 12.3, 0.5)).toBeCloseTo(0.38);
    expect(isFree(world, -18.2, 12.3, 0.16)).toBe(true);
    expect(isFree(world, -15.8, 12.3, 0.16)).toBe(true);
  });
});
