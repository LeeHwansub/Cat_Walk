import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { EatingSequence } from '../src/systems/eating';

function run(seq: EatingSequence, seconds: number, dt = 0.05) {
  let fed = 0;
  let done = 0;
  for (let t = 0; t < seconds; t += dt) {
    const e = seq.update(dt);
    if (e.fed) fed++;
    if (e.done) done++;
  }
  return { fed, done };
}

describe('EatingSequence', () => {
  it('그릇에 다가가는 동안에는 이동을 잠그지 않는다', () => {
    const seq = new EatingSequence(createRng(1));
    expect(seq.phase).toBe('approach');
    expect(seq.locksMovement).toBe(false);
    expect(seq.animBehavior).toBe('walk');
  });

  it('도착하면 냄새 맡기 → 먹기 → 입 핥기 → 끝 순서로 진행한다', () => {
    const seq = new EatingSequence(createRng(1));
    seq.arrive();
    expect(seq.phase).toBe('sniff');
    expect(seq.animBehavior).toBe('sniff');
    run(seq, 1.1);
    expect(seq.phase).toBe('eat');
    expect(seq.animBehavior).toBe('eat');
    run(seq, seq.eatDuration + 0.05);
    expect(seq.phase).toBe('lick');
    expect(seq.animBehavior).toBe('lickLips');
    run(seq, 1.3);
    expect(seq.phase).toBe('done');
  });

  it('냄새 맡기부터 입 핥기까지 이동을 잠그고, 끝나면 푼다', () => {
    const seq = new EatingSequence(createRng(1));
    seq.arrive();
    expect(seq.locksMovement).toBe(true);
    run(seq, 1.1 + seq.eatDuration + 0.05);
    expect(seq.locksMovement).toBe(true); // 입 핥기 중
    run(seq, 1.3);
    expect(seq.locksMovement).toBe(false);
  });

  it('먹는 시간은 5~8초다', () => {
    for (let s = 0; s < 50; s++) {
      const d = new EatingSequence(createRng(s)).eatDuration;
      expect(d).toBeGreaterThanOrEqual(5);
      expect(d).toBeLessThanOrEqual(8);
    }
  });

  it('배부름 회복(fed)과 종료(done)는 한 번씩만 알린다', () => {
    const seq = new EatingSequence(createRng(2));
    seq.arrive();
    const r = run(seq, 20);
    expect(r.fed).toBe(1);
    expect(r.done).toBe(1);
  });

  it('다가가는 중이 아니면 arrive는 무시된다', () => {
    const seq = new EatingSequence(createRng(3));
    seq.arrive();
    run(seq, 2);
    const phase = seq.phase;
    seq.arrive();
    expect(seq.phase).toBe(phase);
  });

  it('다가가는 중에는 시간이 지나도 다음 단계로 넘어가지 않는다', () => {
    const seq = new EatingSequence(createRng(4));
    run(seq, 10);
    expect(seq.phase).toBe('approach');
  });
});
