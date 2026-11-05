import { describe, expect, it } from 'vitest';
import { clampSize, effectiveScale, SIZE_RANGE, STAGE_BASE_SCALE } from '../src/cat/appearance';
import { sizePitch } from '../src/audio/clips';
import { CatController } from '../src/cat/CatController';
import type { CollisionWorld } from '../src/world/collision';

describe('크기 범위 (D-24)', () => {
  it('아기 80~110%, 성체 85~120%', () => {
    expect(SIZE_RANGE.kitten).toEqual([0.8, 1.1]);
    expect(SIZE_RANGE.adult).toEqual([0.85, 1.2]);
  });

  it('범위를 벗어나면 단계 범위 안으로 맞춘다', () => {
    expect(clampSize('kitten', 1.2)).toBe(1.1);
    expect(clampSize('adult', 0.5)).toBe(0.85);
    expect(clampSize('adult', 1)).toBe(1);
  });

  it('잘못된 값은 기본 100%', () => {
    expect(clampSize('adult', Number.NaN)).toBe(1);
  });

  it('실제 크기 = 단계 기준 크기 × 크기 조절 값', () => {
    expect(effectiveScale('adult', 1.2)).toBeCloseTo(1.2);
    expect(effectiveScale('kitten', 1)).toBeCloseTo(STAGE_BASE_SCALE.kitten);
    expect(effectiveScale('kitten', 1.1)).toBeCloseTo(STAGE_BASE_SCALE.kitten * 1.1);
  });
});

describe('울음 음높이', () => {
  it('100%면 그대로, 작을수록 약간 높고 클수록 약간 낮다', () => {
    expect(sizePitch(1)).toBe(1);
    expect(sizePitch(0.8)).toBeGreaterThan(1);
    expect(sizePitch(1.2)).toBeLessThan(1);
    expect(sizePitch(0.8)).toBeLessThan(1.15); // "약간"
  });
});

describe('크기에 따른 걸음 (작을수록 종종걸음)', () => {
  const open: CollisionWorld = { bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, rects: [], circles: [] };

  function walk(scale: number) {
    const c = new CatController(open, 0.24, scale);
    let cycles = 0;
    let last = 0;
    const dt = 1 / 60;
    for (let t = 0; t < 4; t += dt) {
      c.walkTo(0, 100, dt);
      if (c.gaitPhase < last) cycles++;
      last = c.gaitPhase;
    }
    return { speed: c.speed, cycles };
  }

  it('작은 고양이는 더 느리게 이동하지만 걸음은 더 잦다', () => {
    const big = walk(1);
    const small = walk(0.55);
    expect(small.speed).toBeLessThan(big.speed);
    expect(small.cycles).toBeGreaterThan(big.cycles);
  });
});
