import { describe, expect, it } from 'vitest';
import { behaviorWeights, warmPurrSeconds } from '../src/behavior/selector';
import type { BehaviorContext } from '../src/behavior/types';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { mapById } from '../src/world/maps';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

function ctx(over: Partial<BehaviorContext> = {}): BehaviorContext {
  return { now: 100, last: null, activeTime: 0, nearby: [], hunger: 100, cooldowns: {}, ...over };
}
function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0.5, elapsed: 5, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

describe('화로 옆 식빵 (보드 X-05, 5단계 ①)', () => {
  it('화로(warm) 곁에서는 식빵·낮잠을 고를 확률이 오르고 걷기는 줄어든다', () => {
    const cold = behaviorWeights(ctx({ last: 'sit' }));
    const warm = behaviorWeights(ctx({ last: 'sit', nearby: ['warm'] }));
    expect(warm.loaf).toBeGreaterThan(cold.loaf * 2);
    expect(warm.nap).toBeGreaterThan(cold.nap + 1);
    expect(warm.walk).toBeLessThan(cold.walk);
  });

  it('낮잠 쿨다운은 화로 곁에서도 지킨다', () => {
    expect(behaviorWeights(ctx({ nearby: ['warm'], cooldowns: { nap: 200 } })).nap).toBe(0);
  });

  it('화로 곁에서 식빵·낮잠을 시작하면 골골송, 다른 곳·다른 행동은 아니다', () => {
    expect(warmPurrSeconds('loaf', ['warm'], 15)).toBeGreaterThan(5);
    expect(warmPurrSeconds('nap', ['warm'], 30)).toBeGreaterThan(5);
    expect(warmPurrSeconds('loaf', ['warm'], 15)).toBeLessThanOrEqual(15);
    expect(warmPurrSeconds('loaf', ['sunspot'], 15)).toBe(0);
    expect(warmPurrSeconds('walk', ['warm'], 15)).toBe(0);
  });

  it('화로 곁 식빵은 눈을 가늘게 뜬다 (평소 식빵보다 더 감는다)', () => {
    const settle = (cozy: boolean) => {
      const a = new CatAnimator();
      for (let i = 0; i < 300; i++) a.update(input({ behavior: 'loaf', cozy }), 1 / 60);
      return a.pose.eyesClosed;
    };
    expect(settle(true)).toBeGreaterThan(settle(false) + 0.15);
    expect(settle(true)).toBeLessThan(0.9); // 다 감지는 않는다
  });

  it('눈 오는 광장 화로에 반경 2.2m 따뜻한 자리가 있고, 다른 맵에는 없다', () => {
    const xmas = mapById('xmas').build({});
    const warm = xmas.interests.filter((i) => i.kind === 'warm');
    expect(warm).toHaveLength(1);
    expect(warm[0]).toMatchObject({ x: 9.3, z: -0.8, r: 2.2 });
    for (const id of ['neighborhood', 'meadow', 'farm']) expect(mapById(id).build({}).interests.some((i) => i.kind === 'warm')).toBe(false);
  });
});
