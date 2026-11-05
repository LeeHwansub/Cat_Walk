import { describe, expect, it } from 'vitest';
import { behaviorWeights, chooseBehavior, DURATION } from '../src/behavior/selector';
import type { BehaviorContext, BehaviorId } from '../src/behavior/types';
import { createRng } from '../src/core/rng';

function ctx(over: Partial<BehaviorContext> = {}): BehaviorContext {
  return { now: 100, last: null, activeTime: 0, nearby: [], hunger: 100, cooldowns: {}, ...over };
}

function countPicks(c: BehaviorContext, n = 2000): Record<string, number> {
  const rng = createRng(42);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const id = chooseBehavior(c, rng).id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

describe('behaviorWeights', () => {
  it('걷는 중에는 그루밍을 바로 시작하지 않는다 (휴식 중일 때만)', () => {
    expect(behaviorWeights(ctx({ last: 'walk' })).groom).toBe(0);
    expect(behaviorWeights(ctx({ last: 'sit' })).groom).toBeGreaterThan(0);
  });

  it('쿨다운 중인 행동은 선택되지 않는다', () => {
    const w = behaviorWeights(ctx({ last: 'sit', cooldowns: { groom: 150 } }));
    expect(w.groom).toBe(0);
  });

  it('먹이가 가까이 있고 배가 고플 때만 먹는다', () => {
    expect(behaviorWeights(ctx({ nearby: ['food'], hunger: 90 })).eat).toBe(0);
    expect(behaviorWeights(ctx({ nearby: [], hunger: 20 })).eat).toBe(0);
    expect(behaviorWeights(ctx({ nearby: ['food'], hunger: 20 })).eat).toBeGreaterThan(0);
  });

  it('흥미로운 사물이 가까이 있으면 냄새 맡기 가중치가 오른다', () => {
    const base = behaviorWeights(ctx()).sniff;
    expect(behaviorWeights(ctx({ nearby: ['flower'] })).sniff).toBeGreaterThan(base);
  });

  it('오래 활동하면 휴식 행동의 비중이 커진다', () => {
    const fresh = behaviorWeights(ctx());
    const tired = behaviorWeights(ctx({ activeTime: 100 }));
    expect(tired.walk).toBeLessThan(fresh.walk);
    expect(tired.nap).toBeGreaterThan(fresh.nap);
  });
});

describe('chooseBehavior', () => {
  it('직전 행동을 연속으로 반복하는 비율이 낮다', () => {
    const counts = countPicks(ctx({ last: 'sit' }));
    expect((counts.sit ?? 0) / 2000).toBeLessThan(0.1);
  });

  it('여러 종류의 행동이 골고루 나온다', () => {
    const counts = countPicks(ctx({ last: 'idle' }));
    const kinds = Object.keys(counts) as BehaviorId[];
    expect(kinds.length).toBeGreaterThanOrEqual(4);
  });

  it('지속 시간은 행동별 범위 안에 있다', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const c = chooseBehavior(ctx({ last: 'sit', nearby: ['food', 'grass'], hunger: 10, activeTime: 120 }), rng);
      const [min, max] = DURATION[c.id];
      expect(c.duration).toBeGreaterThanOrEqual(min);
      expect(c.duration).toBeLessThanOrEqual(max);
    }
  });

  it('같은 시드면 같은 결과를 낸다', () => {
    const a = chooseBehavior(ctx(), createRng(1));
    const b = chooseBehavior(ctx(), createRng(1));
    expect(a).toEqual(b);
  });
});
