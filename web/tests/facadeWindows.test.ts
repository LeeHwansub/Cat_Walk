import { describe, expect, it } from 'vitest';
import { windowRects } from '../src/world/parts/details';

/**
 * 외벽 텍스처(facadeTexture): 128px 한 장에 창 하나. 창 가로 28~100px, 세로 34~84px(위에서).
 * 상자 앞면 텍스처: v는 아래(0)에서 위(1), u는 +z 면이면 minX부터, −z 면이면 maxX부터 늘어난다.
 */
describe('외벽 창 위치 (windowRects)', () => {
  const base = { minX: 0, maxX: 6, height: 6, tileW: 3, tileH: 3 };

  it('타일마다 창 하나: 가로 가운데, 높이는 층 바닥에서 1.03~2.20m', () => {
    const r = windowRects({ ...base, uFromMax: false });
    expect(r).toHaveLength(4);
    const first = r.find((w) => w.floor === 0 && w.x < 3)!;
    expect(first.x).toBeCloseTo(1.5, 5);
    expect(first.w).toBeCloseTo(3 * (72 / 128), 5);
    expect(first.y0).toBeCloseTo(3 * (1 - 84 / 128), 5);
    expect(first.y1).toBeCloseTo(3 * (1 - 34 / 128), 5);
  });

  it('−z 면(u가 maxX부터)에서는 타일이 오른쪽 끝부터 시작한다', () => {
    // 폭 4m, 타일 3m: +z 면이면 창 가운데 1.5, −z 면이면 4 − 1.5 = 2.5
    const a = windowRects({ ...base, maxX: 4, height: 3, uFromMax: false });
    const b = windowRects({ ...base, maxX: 4, height: 3, uFromMax: true });
    expect(a.map((w) => +w.x.toFixed(3))).toEqual([1.5]);
    expect(b.map((w) => +w.x.toFixed(3))).toEqual([2.5]);
  });

  it('면 밖으로 잘리는 창(마지막 타일·맨 위 층의 일부)은 넣지 않는다', () => {
    const r = windowRects({ minX: 0, maxX: 4, height: 4, tileW: 3, tileH: 3, uFromMax: false });
    for (const w of r) {
      expect(w.x - w.w / 2).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w / 2).toBeLessThanOrEqual(4);
      expect(w.y1).toBeLessThanOrEqual(4);
    }
    expect(r).toHaveLength(1);
  });
});
