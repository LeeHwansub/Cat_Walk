import { describe, expect, it } from 'vitest';
import { BalloonFloat, isBalloon } from '../src/systems/balloon';

describe('풍선 이스터 에그', () => {
  it('체형이 최대(130%)일 때만 켜진다', () => {
    expect(isBalloon(1.3)).toBe(true);
    expect(isBalloon(1.29)).toBe(false);
    expect(isBalloon(1)).toBe(false);
  });

  it('켜지면 천천히 떠올라 목표 높이 근처에서 둥실거린다', () => {
    const b = new BalloonFloat();
    let maxStep = 0;
    let prev = 0;
    for (let t = 0; t < 6; t += 1 / 60) {
      const h = b.update(1 / 60, t, true, 1);
      maxStep = Math.max(maxStep, Math.abs(h - prev));
      prev = h;
    }
    expect(prev).toBeGreaterThan(1.0);
    expect(prev).toBeLessThan(1.4);
    expect(maxStep).toBeLessThan(0.05); // 순간이동하지 않는다
    expect(b.amount).toBeGreaterThan(0.95);
  });

  it('꺼지면 천천히 내려와 땅에 닿는다 (땅 아래로는 안 내려간다)', () => {
    const b = new BalloonFloat();
    for (let t = 0; t < 6; t += 1 / 60) b.update(1 / 60, t, true, 1);
    let h = 1;
    let min = Infinity;
    for (let t = 6; t < 14; t += 1 / 60) {
      h = b.update(1 / 60, t, false, 1);
      min = Math.min(min, h);
    }
    expect(h).toBeCloseTo(0, 2);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(b.amount).toBeLessThan(0.05);
  });

  it('작은 고양이는 낮게 뜬다 (크기에 비례)', () => {
    const big = new BalloonFloat();
    const small = new BalloonFloat();
    let hb = 0;
    let hs = 0;
    for (let t = 0; t < 6; t += 1 / 60) {
      hb = big.update(1 / 60, t, true, 1);
      hs = small.update(1 / 60, t, true, 0.6);
    }
    expect(hs).toBeLessThan(hb);
  });
});
