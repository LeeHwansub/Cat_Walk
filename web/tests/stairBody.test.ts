import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import { bodyOnGround } from '../src/cat/slope';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import type { CollisionWorld } from '../src/world/collision';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

const world = buildNeighborhood().collision;
const STAIR_X = -18.05; // 외부 계단 가운데 줄 (J-4), 북쪽(+z)으로 오른다
const dt = 1 / 60;

describe('계단에서 보이는 몸: 경사로처럼 부드럽게 (사용자 요청 2026-11-10 "한 계단 한 계단 오르는 느낌")', () => {
  it('평지에서는 판정 높이 그대로, 기울지 않는다', () => {
    const b = bodyOnGround(world, -6, 0.3, 0, 0, 1);
    expect(b.y).toBeCloseTo(0);
    expect(b.pitch).toBeCloseTo(0);
  });

  it('계단 위에서는 앞발 쪽이 높아 머리를 들어 기울고(경사 약 33°의 절반 이상), 몸 높이는 앞뒤 발 사이', () => {
    const y = 0.667; // 4번째 칸 위
    const b = bodyOnGround(world, STAIR_X, 5.1, y, 0, 1);
    expect(b.pitch).toBeGreaterThan(0.3);
    expect(b.pitch).toBeLessThan(0.75);
    expect(b.y).toBeGreaterThan(y - 0.17);
    expect(b.y).toBeLessThan(y + 0.17);
  });

  it('걸어 올라갈 때 보이는 몸 높이가 매끄럽다: 한 프레임에 한 칸(0.167m)씩 툭 오르지 않는다', () => {
    const c = new CatController(world, 0.4);
    c.x = STAIR_X;
    c.z = 3.6;
    c.heading = 0;
    let prev = c.bodyY;
    let maxStep = 0;
    let ys: number[] = [];
    for (let i = 0; i < 60 * 14 && c.z < 8.5; i++) {
      c.moveDirect(0, 1, dt);
      maxStep = Math.max(maxStep, Math.abs(c.bodyY - prev));
      prev = c.bodyY;
      ys.push(c.bodyY);
    }
    expect(c.y).toBeGreaterThan(2); // 실제로 올라갔다
    expect(maxStep).toBeLessThan(0.03); // 예전: 한 칸을 0.1초에 (프레임당 약 0.025m씩 4프레임 + 나머지 평평)
    // 평평하게 멈춰 있는 구간이 길지 않다 (높이가 거의 그대로인 연속 프레임 수)
    let flat = 0;
    let longest = 0;
    for (let i = 1; i < ys.length; i++) {
      flat = Math.abs(ys[i] - ys[i - 1]) < 1e-4 && ys[i] > 0.2 && ys[i] < 2.8 ? flat + 1 : 0;
      longest = Math.max(longest, flat);
    }
    expect(longest).toBeLessThan(6);
  });

  it('높은 곳 가장자리(턱보다 깊게 꺼지는 곳)에서는 앞으로 고꾸라지지 않는다', () => {
    const edge: CollisionWorld = { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, rects: [{ minX: -1, maxX: 1, minZ: -1, maxZ: 0, top: 1 }], circles: [] };
    const b = bodyOnGround(edge, 0, -0.05, 1, 0, 1); // 앞발 쪽(+z)은 바닥 0
    expect(b.pitch).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(1);
  });
});
