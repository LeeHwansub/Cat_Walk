import { describe, expect, it } from 'vitest';
import { BehaviorBrain } from '../src/behavior/brain';
import { createRng } from '../src/core/rng';

const sense = { nearby: [], hunger: 100 } as const;

describe('BehaviorBrain', () => {
  it('현재 행동의 지속 시간이 끝나면 다음 행동으로 넘어간다', () => {
    const brain = new BehaviorBrain(createRng(3));
    brain.interrupt('sit', 2, 0);
    let now = 0;
    let changed = false;
    while (now < 2.5) {
      now += 0.1;
      changed = brain.update(0.1, now, { ...sense, nearby: [] }) || changed;
    }
    expect(changed).toBe(true);
    expect(brain.last).toBe('sit');
  });

  it('그루밍을 마치면 쿨다운이 걸린다', () => {
    const brain = new BehaviorBrain(createRng(3));
    brain.interrupt('groom', 1, 0);
    brain.update(1.1, 1.1, { ...sense, nearby: [] });
    expect(brain.cooldowns.groom ?? 0).toBeGreaterThan(1.1);
  });

  it('걷는 동안 활동 시간이 쌓이고 낮잠 후에는 초기화된다', () => {
    const brain = new BehaviorBrain(createRng(3));
    brain.interrupt('walk', 10, 0);
    brain.update(5, 5, { ...sense, nearby: [] });
    expect(brain.activeTime).toBeCloseTo(5);
    brain.interrupt('nap', 1, 5);
    brain.update(1.1, 6.1, { ...sense, nearby: [] });
    expect(brain.activeTime).toBe(0);
  });

  it('finishCurrent는 행동을 즉시 끝내고 새 행동을 고른다', () => {
    const brain = new BehaviorBrain(createRng(3));
    brain.interrupt('walk', 100, 0);
    brain.finishCurrent(1, { ...sense, nearby: [] });
    expect(brain.last).toBe('walk');
    expect(brain.current.startedAt).toBe(1);
  });
});
