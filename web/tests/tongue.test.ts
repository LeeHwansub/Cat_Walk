import { describe, expect, it } from 'vitest';
import { tongueOut } from '../src/cat/tongue';

const samples = (lick: number) => Array.from({ length: 200 }, (_, i) => tongueOut(lick, i / 60));

describe('혀 내밀기 (tongueOut)', () => {
  it('핥지 않으면 혀가 나오지 않는다', () => {
    expect(Math.max(...samples(0))).toBe(0);
  });

  it('냄새 맡기(핥기 0.3)처럼 약하게 핥을 때는 혀가 나오지 않는다', () => {
    expect(Math.max(...samples(0.3))).toBe(0);
  });

  it('그루밍·밥 먹기(핥기 1)에서는 핥는 리듬으로 내밀었다 넣는다', () => {
    const s = samples(1);
    expect(Math.max(...s)).toBeGreaterThan(0.8);
    expect(Math.min(...s)).toBeLessThan(0.5);
    expect(Math.max(...s)).toBeLessThanOrEqual(1);
  });

  it('핥기 값이 클수록 더 많이 내민다', () => {
    expect(Math.max(...samples(0.6))).toBeLessThan(Math.max(...samples(1)));
  });
});
