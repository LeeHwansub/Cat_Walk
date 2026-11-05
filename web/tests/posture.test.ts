import { describe, expect, it } from 'vitest';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { postureBlocksMovement } from '../src/cat/posture';

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

/** 앉은 자세에서 시작해 자세가 이동 가능 기준 아래로 내려갈 때까지 걸린 시간 */
function timeToStand(standingUp: boolean, from: 'sit' | 'lie'): number {
  const a = new CatAnimator();
  a.pose[from] = 1;
  const dt = 1 / 60;
  for (let t = 0; t < 5; t += dt) {
    a.update(input({ standingUp }), dt);
    if (!postureBlocksMovement(a.pose)) return t + dt;
  }
  return Infinity;
}

describe('postureBlocksMovement', () => {
  it('앉거나 엎드린 자세에서는 이동할 수 없다', () => {
    expect(postureBlocksMovement({ sit: 1, lie: 0 })).toBe(true);
    expect(postureBlocksMovement({ sit: 0, lie: 0.5 })).toBe(true);
  });

  it('거의 선 자세면 이동할 수 있다', () => {
    expect(postureBlocksMovement({ sit: 0.05, lie: 0.02 })).toBe(false);
  });
});

describe('일어서기 동작', () => {
  it('앉은 자세에서 0.3~0.5초 안에 일어선다', () => {
    const t = timeToStand(true, 'sit');
    expect(t).toBeGreaterThanOrEqual(0.3);
    expect(t).toBeLessThanOrEqual(0.5);
  });

  it('엎드린 자세에서도 0.3~0.5초 안에 일어선다', () => {
    const t = timeToStand(true, 'lie');
    expect(t).toBeGreaterThanOrEqual(0.3);
    expect(t).toBeLessThanOrEqual(0.5);
  });

  it('일어서기 중에는 쓰다듬기 반응(앉기)보다 일어서기가 우선한다', () => {
    const a = new CatAnimator();
    a.pose.sit = 1;
    for (let i = 0; i < 40; i++) a.update(input({ standingUp: true, petted: true }), 1 / 60);
    expect(postureBlocksMovement(a.pose)).toBe(false);
  });
});

describe('입 핥기 동작', () => {
  it('입 핥기 행동은 핥기 동작 값을 만든다', () => {
    const a = new CatAnimator();
    for (let i = 0; i < 30; i++) a.update(input({ behavior: 'lickLips' }), 1 / 60);
    expect(a.pose.lick).toBeGreaterThan(0.5);
  });
});
