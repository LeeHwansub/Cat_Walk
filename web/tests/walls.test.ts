import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { isFree } from '../src/world/collision';
import { wall } from '../src/world/parts/buildings';
import { MapKit } from '../src/world/parts/kit';

// 블록 담 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

function kit() {
  const k = new MapKit(createRng(1));
  k.beginZone('t');
  return k;
}
const f = { side: 1 as const, wallZ: 3.3 };

describe('담 변형 (몸체·윗부분·대문)', () => {
  it('윗부분별 윗면 높이와 올라설 수 있는지를 돌려준다 (철망 담은 못 올라감)', () => {
    const flat = wall(kit(), 0, 4, f, [], { body: 'cement', cap: 'flat' });
    const tile = wall(kit(), 0, 4, f, [], { body: 'block', cap: 'tile' });
    const mesh = wall(kit(), 0, 4, f, [], { body: 'cement', cap: 'mesh' });
    expect(flat[0].climbable).toBe(true);
    expect(tile[0].climbable).toBe(true);
    expect(mesh[0].climbable).toBe(false);
    expect(tile[0].top).toBeGreaterThan(flat[0].top);
    for (const w of [...flat, ...tile, ...mesh]) {
      expect(w.z).toBeCloseTo(3.3);
      expect(w.top).toBeGreaterThan(1.3);
    }
  });

  it('대문 자리는 비워 둬서 지나갈 수 있고, 담 조각마다 윗면 정보가 하나씩', () => {
    const k = kit();
    const tops = wall(k, 0, 6, f, [[2, 3.4]], { body: 'cement', cap: 'flat' }, true);
    expect(tops).toHaveLength(2);
    expect(isFree({ bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, rects: k.rects, circles: k.circles }, 2.7, 3.3, 0.18)).toBe(true);
  });

  it('스타일을 주지 않으면 무작위로 고른다 (같은 시드면 같은 결과)', () => {
    const a = wall(kit(), 0, 4, f, []);
    const b = wall(kit(), 0, 4, f, []);
    expect(a).toEqual(b);
  });
});
