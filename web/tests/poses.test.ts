import { describe, expect, it } from 'vitest';
import { behaviorWeights, chooseBehavior, DURATION } from '../src/behavior/selector';
import { REST_BEHAVIORS, type BehaviorContext, type BehaviorId } from '../src/behavior/types';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { postureBlocksMovement } from '../src/cat/posture';
import { POSE_MENU } from '../src/ui/poseMenu';
import { createRng } from '../src/core/rng';

const POSES: BehaviorId[] = ['loaf', 'sideLie', 'bellyUp', 'stretch', 'tailWrap', 'manSit'];

function ctx(over: Partial<BehaviorContext> = {}): BehaviorContext {
  return { now: 100, last: null, activeTime: 0, nearby: [], hunger: 100, cooldowns: {}, ...over };
}

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

/** 행동을 n초 동안 유지한 뒤의 자세 */
function settle(behavior: AnimInput['behavior'], seconds = 4, progress = 0.5) {
  const a = new CatAnimator();
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) a.update(input({ behavior, progress, elapsed: t }), dt);
  return a.pose;
}

describe('포즈 6종 — 자율 행동 선택', () => {
  it('자동 생활은 포즈 메뉴의 자세만 고르고, 메뉴의 자세는 모두 한 번 이상 고른다 (사용자 요청 2026-11-11)', () => {
    const rng = createRng(11);
    const seen = new Set<BehaviorId>();
    const lasts: (BehaviorId | null)[] = [null, 'sit', 'nap', 'walk', 'tailWrap', 'loaf'];
    for (let i = 0; i < 6000; i++) {
      const last = lasts[i % lasts.length];
      const c = chooseBehavior(ctx({ last, activeTime: i % 3 === 0 ? 100 : 10, nearby: i % 2 ? ['sunspot'] : [], fold: i % 4 === 0 }), rng);
      seen.add(c.id);
    }
    const menu = POSE_MENU.map((p) => p.id);
    for (const id of menu) expect(seen.has(id), id).toBe(true);
    // 메뉴에 없는 것은 자세가 아닌 행동(서 있기·걷기·냄새 맡기·먹기)뿐: 배 보이기·예전 옆으로 눕기는 고르지 않는다
    for (const id of seen) expect([...menu, 'idle', 'walk', 'sniff', 'eat'], id).toContain(id);
  });

  it('기지개는 눕거나 자고 일어난 직후에만 한다', () => {
    expect(behaviorWeights(ctx({ last: 'walk' })).stretch).toBe(0);
    expect(behaviorWeights(ctx({ last: null })).stretch).toBe(0);
    for (const last of ['nap', 'sideLie', 'bellyUp', 'loaf', 'tailWrap'] as BehaviorId[]) {
      expect(behaviorWeights(ctx({ last })).stretch).toBeGreaterThan(1);
    }
  });

  it('아저씨 앉기는 접힌 귀(스코티시폴드)일 때 훨씬 자주 한다', () => {
    expect(behaviorWeights(ctx({ fold: true })).manSit).toBeGreaterThan(behaviorWeights(ctx({ fold: false })).manSit * 3);
  });

  it('옆으로 눕기(꼬리 감기)는 햇볕 자리에서, 지쳤을 때 더 자주 한다', () => {
    const base = behaviorWeights(ctx());
    const sunny = behaviorWeights(ctx({ nearby: ['sunspot'] }));
    const tired = behaviorWeights(ctx({ activeTime: 100 }));
    expect(sunny.tailWrap).toBeGreaterThan(base.tailWrap);
    expect(tired.tailWrap).toBeGreaterThan(base.tailWrap);
    for (const w of [base, sunny, tired]) expect(w.sideLie + w.bellyUp).toBe(0);
  });

  it('누워 있는 포즈는 휴식으로 취급해 그 뒤에 그루밍을 할 수 있다', () => {
    for (const id of ['loaf', 'sideLie', 'bellyUp', 'tailWrap', 'manSit'] as BehaviorId[]) {
      expect(REST_BEHAVIORS).toContain(id);
      expect(behaviorWeights(ctx({ last: id })).groom).toBeGreaterThan(0);
    }
  });

  it('포즈 지속 시간은 범위 안에 있다', () => {
    for (const id of POSES) {
      const [min, max] = DURATION[id];
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
    }
  });
});

describe('포즈 6종 — 자세 값', () => {
  it('식빵: 엎드리고 앞발을 몸 아래로 접는다', () => {
    const p = settle('loaf');
    expect(p.lie).toBeGreaterThan(0.9);
    expect(p.tuck).toBeGreaterThan(0.9);
    expect(p.roll).toBeLessThan(0.05);
  });

  it('옆으로 눕기는 몸을 옆으로(roll 0.5), 배 보이고 눕기는 거의 뒤집는다(roll 1)', () => {
    const side = settle('sideLie', 6);
    const belly = settle('bellyUp', 6);
    expect(side.roll).toBeGreaterThan(0.45);
    expect(side.roll).toBeLessThan(0.55);
    expect(belly.roll).toBeGreaterThan(0.9);
  });

  it('기지개: 진행 중간에 앞쪽을 낮추고, 끝나면 풀린다', () => {
    expect(settle('stretch', 3, 0.5).stretch).toBeGreaterThan(0.9);
    expect(settle('stretch', 3, 1).stretch).toBeLessThan(0.05);
  });

  it('꼬리 감고 엎드리기: 엎드려 꼬리를 몸에 감는다', () => {
    const p = settle('tailWrap');
    expect(p.lie).toBeGreaterThan(0.9);
    expect(p.tailWrap).toBeGreaterThan(0.9);
  });

  it('아저씨 앉기: 앉은 상태에서 상체를 세운다', () => {
    const p = settle('manSit');
    expect(p.sit).toBeGreaterThan(0.9);
    expect(p.manSit).toBeGreaterThan(0.9);
  });

  it('새 포즈에서는 걸을 수 없다 (먼저 일어서야 한다)', () => {
    for (const id of POSES) expect(postureBlocksMovement(settle(id, 4, 0.5))).toBe(true);
  });

  it('새 포즈에서도 일어서기 요청 시 0.5초 안에 걸을 수 있는 자세가 된다', () => {
    for (const id of POSES) {
      const a = new CatAnimator();
      const dt = 1 / 60;
      for (let t = 0; t < 4; t += dt) a.update(input({ behavior: id, progress: 0.5, elapsed: t }), dt);
      let took = Infinity;
      for (let t = 0; t < 2; t += dt) {
        a.update(input({ behavior: id, progress: 0.5, standingUp: true }), dt);
        if (!postureBlocksMovement(a.pose)) {
          took = t + dt;
          break;
        }
      }
      expect(took, id).toBeLessThanOrEqual(0.5);
    }
  });

  it('쓰다듬으면 눕기·뒤집기 포즈에서도 앉아서 반응한다', () => {
    const a = new CatAnimator();
    const dt = 1 / 60;
    for (let t = 0; t < 4; t += dt) a.update(input({ behavior: 'bellyUp', progress: 0.5 }), dt);
    for (let t = 0; t < 3; t += dt) a.update(input({ behavior: 'bellyUp', progress: 0.5, petted: true }), dt);
    expect(a.pose.roll).toBeLessThan(0.1);
    expect(a.pose.sit).toBeGreaterThan(0.9);
  });
});
