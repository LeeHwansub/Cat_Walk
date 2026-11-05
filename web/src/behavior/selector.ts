import { range, type Rng } from '../core/rng';
import { REST_BEHAVIORS, type BehaviorChoice, type BehaviorContext, type BehaviorId } from './types';

/** 행동별 지속 시간 범위 (초) */
export const DURATION: Record<BehaviorId, [number, number]> = {
  idle: [3, 7],
  walk: [8, 16],
  sit: [6, 14],
  lookAround: [3, 6],
  sniff: [2.5, 5],
  groom: [8, 11],
  nap: [20, 40],
  eat: [5, 7],
};

/** 행동이 끝난 뒤 다시 고를 수 있을 때까지의 대기 시간 (초). 그루밍 과다 반복 방지 (기획서 5.2) */
export const COOLDOWN: Partial<Record<BehaviorId, number>> = {
  groom: 40,
  nap: 120,
  sniff: 6,
  eat: 30,
};

const SNIFF_TARGETS = ['grass', 'flower', 'pot', 'car'] as const;
const REST_SPOTS = ['sunspot', 'bench'] as const;

/**
 * 현재 상황에서 각 행동의 가중치를 계산한다.
 * 단순 무작위가 아니라 직전 행동, 활동량, 주변 환경, 배고픔에 따라 달라진다. (기획서 5.4)
 */
export function behaviorWeights(ctx: BehaviorContext): Record<BehaviorId, number> {
  const w: Record<BehaviorId, number> = {
    idle: 1.5,
    walk: 3,
    sit: 1.5,
    lookAround: 1.5,
    sniff: 0.3,
    groom: 0,
    nap: 0,
    eat: 0,
  };

  const resting = ctx.last !== null && REST_BEHAVIORS.includes(ctx.last);
  if (resting) w.groom = 1.2; // 그루밍은 휴식 중에만
  if (ctx.last === 'groom') {
    w.sit += 1;
    w.nap += 0.8; // 그루밍 후 휴식
  }

  if (ctx.activeTime > 45) {
    w.walk *= 0.4;
    w.sit += 1.5;
    w.nap += 0.6;
  }
  if (ctx.activeTime > 90) w.nap += 1.5;

  if (ctx.nearby.some((k) => (SNIFF_TARGETS as readonly string[]).includes(k))) w.sniff += 2;
  if (ctx.nearby.some((k) => (REST_SPOTS as readonly string[]).includes(k))) {
    w.nap += 1;
    w.sit += 0.5;
  }
  if (ctx.nearby.includes('food') && ctx.hunger < 70) w.eat = 5;

  // 같은 행동 연속 반복 방지 (걷기는 이어질 수 있으므로 덜 줄인다)
  if (ctx.last) w[ctx.last] *= ctx.last === 'walk' ? 0.5 : 0.08;

  for (const id of Object.keys(w) as BehaviorId[]) {
    const until = ctx.cooldowns[id];
    if (until !== undefined && until > ctx.now) w[id] = 0;
  }
  return w;
}

export function chooseBehavior(ctx: BehaviorContext, rng: Rng): BehaviorChoice {
  const w = behaviorWeights(ctx);
  const ids = Object.keys(w) as BehaviorId[];
  const total = ids.reduce((s, id) => s + w[id], 0);
  let id: BehaviorId = 'idle';
  if (total > 0) {
    let r = rng() * total;
    for (const candidate of ids) {
      r -= w[candidate];
      if (r < 0) {
        id = candidate;
        break;
      }
    }
  }
  const [min, max] = DURATION[id];
  return { id, duration: range(rng, min, max) };
}
