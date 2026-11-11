import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { groundAt, isFree, pathClear, resolveCircle, STEP_UP, type CollisionWorld } from '../src/world/collision';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { wall } from '../src/world/parts/buildings';
import { MapKit } from '../src/world/parts/kit';
import { car } from '../src/world/parts/props';

// 지도의 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다). Node에는 document가 없다
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

/** 담(윗면 1.36) · 계단 한 칸(0.17) · 건물(윗면 없음) · 원형 받침(0.5) */
const world: CollisionWorld = {
  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  rects: [
    { minX: 0, maxX: 4, minZ: -0.1, maxZ: 0.1, top: 1.36 },
    { minX: 0, maxX: 1, minZ: 3, maxZ: 3.3, top: 0.17 },
    { minX: -4, maxX: -2, minZ: -4, maxZ: -2 },
  ],
  circles: [{ x: 5, z: 5, r: 0.3, top: 0.5 }],
};

describe('높이 있는 충돌 (J-0)', () => {
  it('groundAt: 지금 높이 + 턱 이하의 가장 높은 윗면, 없으면 0', () => {
    expect(groundAt(world, 2, 0, 1.36)).toBeCloseTo(1.36); // 담 위
    expect(groundAt(world, 2, 0, 0)).toBe(0); // 담 밑에서는 담 윗면에 닿지 않는다
    expect(groundAt(world, 2, 1, 1.36)).toBe(0); // 담 옆 허공 → 바닥
    expect(groundAt(world, 0.5, 3.1, 0)).toBeCloseTo(0.17); // 계단 한 칸은 걸어서 오른다
    expect(groundAt(world, 5, 5, 0.5)).toBeCloseTo(0.5); // 원형 윗면
    expect(groundAt(world, -3, -3, 5)).toBe(0); // 윗면 없는 물체(건물)는 땅이 되지 않는다
  });

  it('groundAt: 겹친 윗면 중 닿을 수 있는 가장 높은 것', () => {
    const w: CollisionWorld = {
      ...world,
      rects: [
        { minX: 0, maxX: 2, minZ: 0, maxZ: 2, top: 0.17 },
        { minX: 0, maxX: 2, minZ: 0, maxZ: 2, top: 0.34 },
        { minX: 0, maxX: 2, minZ: 0, maxZ: 2, top: 1.2 },
      ],
    };
    expect(groundAt(w, 1, 1, 0.17)).toBeCloseTo(0.34);
    expect(groundAt(w, 1, 1, 1.2)).toBeCloseTo(1.2);
  });

  it('막힘: 윗면이 지금 높이 + 턱보다 높으면 막고, 낮으면 지나간다', () => {
    // 바닥에서 담으로 들어가면 밀려난다
    expect(resolveCircle(world, 2, 0.05, 0.18).z).toBeCloseTo(0.28);
    // 담 위 높이에서는 담이 막지 않는다
    expect(resolveCircle(world, 2, 0.05, 0.18, 1.36)).toEqual({ x: 2, z: 0.05 });
    // 계단 한 칸은 바닥에서도 막지 않는다
    expect(isFree(world, 0.5, 3.1, 0.18)).toBe(true);
    // 윗면 없는 물체는 어느 높이에서도 막는다
    expect(isFree(world, -3, -3, 0.18, 9)).toBe(false);
    // 원형도 같다
    expect(isFree(world, 5, 5, 0.18, 0)).toBe(false);
    expect(isFree(world, 5, 5, 0.18, 0.5)).toBe(true);
    // 경로: 담 위 높이에서는 담을 따라 걸을 수 있다
    expect(pathClear(world, 0.5, 0, 3.5, 0, 0.18)).toBe(false);
    expect(pathClear(world, 0.5, 0, 3.5, 0, 0.18, 1.36)).toBe(true);
  });

  it('턱 높이는 계단 한 칸(0.17m)보다 크다', () => {
    expect(STEP_UP).toBeGreaterThan(0.17);
  });
});

describe('맵 물체 높이', () => {
  function kit() {
    const k = new MapKit(createRng(1));
    k.beginZone('t');
    return k;
  }

  it('평지 회귀 없음: 턱보다 낮은 윗면은 외부 계단 첫 칸(J-4)뿐이다 (그 밖에는 높이 0에서 전처럼 막힌다)', () => {
    const map = buildNeighborhood();
    const low = [...map.collision.rects].filter((s) => s.top !== undefined && s.top <= STEP_UP);
    expect(low.map((s) => [s.minX, s.minZ])).toEqual([[-18.5, 4.0]]);
    for (const s of map.collision.circles) if (s.top !== undefined) expect(s.top).toBeGreaterThan(STEP_UP);
  });

  it('담의 충돌 윗면은 WallTop과 같고, 철망 담은 올라설 수 없다', () => {
    const f = { side: 1 as const, wallZ: 3.3 };
    for (const cap of ['flat', 'tile', 'mesh'] as const) {
      const k = kit();
      const [t] = wall(k, 0, 4, f, [], { body: 'cement', cap });
      expect(k.rects[0].top).toBe(t.climbable ? t.top : undefined);
    }
  });

  it('차는 보닛·트렁크만 올라설 수 있고 지붕(실내)은 막는다 (가로·세로 주차 모두)', () => {
    for (const rotY of [0, Math.PI / 2]) {
      const k = kit();
      car(k, 0, 0, '#ffffff', rotY);
      const w: CollisionWorld = { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, rects: k.rects, circles: k.circles };
      const at = (l: number) => (rotY === 0 ? [l, 0] : [0, -l]) as [number, number]; // 차 길이 방향 l(m) 위치
      const [hx, hz] = at(1.6);
      const [tx, tz] = at(-1.8);
      const [cx, cz] = at(-0.2);
      expect(groundAt(w, hx, hz, 1)).toBeGreaterThan(0.9); // 보닛
      expect(groundAt(w, tx, tz, 1)).toBeGreaterThan(0.9); // 트렁크
      expect(groundAt(w, cx, cz, 5)).toBe(0); // 실내 위는 땅이 아니다
      expect(isFree(w, cx, cz, 0.18, 1)).toBe(false); // 보닛 높이에서 실내 쪽은 막힌다
      expect(isFree(w, hx, hz, 0.18, 0)).toBe(false); // 바닥에서는 차 전체가 막는다
    }
  });
});
