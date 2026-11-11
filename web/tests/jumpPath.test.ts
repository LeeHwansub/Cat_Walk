import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import { findLanding } from '../src/cat/jump';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { groundAt, isFree, type CollisionWorld } from '../src/world/collision';

// 지도의 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다). Node에는 document가 없다
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

const dt = 1 / 60;
const R = 0.16;
const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

/** 점프를 끝까지 돌리며 매 프레임 그 높이에서 막히는 곳에 들어갔는지 본다. 뚫은 프레임 수를 돌려준다 */
function clipFrames(world: CollisionWorld, c: CatController, r = R * 0.75): number {
  let bad = 0;
  for (let i = 0; i < 240 && c.jumping; i++) {
    c.brake(dt);
    if (!isFree(world, c.x, c.z, r, c.y)) bad++;
  }
  return bad;
}

/** 차 한 대: 트렁크(0.97) · 실내(올라설 수 없음) · 보닛(0.97), 폭 1.8 */
const car: CollisionWorld = {
  bounds,
  rects: [
    { minX: -0.9, maxX: 0.9, minZ: 0, maxZ: 0.75, top: 0.97 },
    { minX: -0.9, maxX: 0.9, minZ: 0.75, maxZ: 3.05 },
    { minX: -0.9, maxX: 0.9, minZ: 3.05, maxZ: 4.2, top: 0.97 },
  ],
  circles: [],
};

describe('점프 경로가 물체를 뚫지 않는다', () => {
  it('차 트렁크에 바짝 붙어 뛰어도 옆면을 뚫지 않고 트렁크 위에 선다', () => {
    const c = new CatController(car, 0.4);
    c.x = 0;
    c.z = -R - 0.01; // 트렁크 뒷면에 붙음
    c.heading = 0;
    c.jump();
    expect(clipFrames(car, c)).toBe(0);
    expect(c.y).toBeCloseTo(0.97);
  });

  it('차 옆구리(트렁크 쪽)에 붙어 옆으로 뛰어도 뚫지 않는다', () => {
    const c = new CatController(car, 0.4);
    c.x = -0.9 - R - 0.01;
    c.z = 0.4;
    c.heading = Math.PI / 2;
    c.jump();
    expect(clipFrames(car, c)).toBe(0);
    expect(c.y).toBeCloseTo(0.97);
  });

  it('보닛 위에서 뛰어내릴 때 보닛 가장자리를 파고들지 않는다', () => {
    for (const heading of [Math.PI / 2, -Math.PI / 2, 0]) {
      const c = new CatController(car, 0.4);
      c.x = 0;
      c.z = 3.6;
      c.y = 0.97;
      c.heading = heading;
      c.jump();
      expect(clipFrames(car, c), `heading ${heading}`).toBe(0);
      expect(c.y).toBe(0);
    }
  });

  it('사이에 올라설 수 없는 물체(기둥)가 있으면 그 너머로 뛰지 않는다', () => {
    const w: CollisionWorld = {
      bounds,
      rects: [{ minX: -3, maxX: 3, minZ: 1.0, maxZ: 1.26, top: 0.9 }],
      circles: [{ x: 0, z: 0.55, r: 0.15 }],
    };
    expect(findLanding(w, 0, 0, 0, 0, 1, R)).toBeNull();
  });

  it('실제 동네 지도: 어디서 어느 쪽으로 뛰어도 날아가는 동안 물체를 뚫지 않는다', () => {
    const w = buildNeighborhood().collision;
    const b = w.bounds;
    const bad: string[] = [];
    for (let x = b.minX + 0.5; x < b.maxX; x += 0.45) {
      for (let z = b.minZ + 0.5; z < b.maxZ; z += 0.45) {
        const high = groundAt(w, x, z, 5);
        for (const y of high > 0.3 ? [0, high] : [0]) {
          if (!isFree(w, x, z, R, y) || groundAt(w, x, z, y) !== y) continue;
          for (let h = 0; h < 8; h++) {
            const c = new CatController(w, 0.4);
            c.x = x;
            c.z = z;
            c.y = y;
            c.heading = (h / 8) * Math.PI * 2;
            c.jump();
            if (clipFrames(w, c) > 0) bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}, y ${y}) h${h}`);
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  }, 20000); // 맵 전체(0.45m 간격 × 8방향)를 시뮬레이션해 다른 테스트와 함께 돌면 5초를 넘길 때가 있다
});
