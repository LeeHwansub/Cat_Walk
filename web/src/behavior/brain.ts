import type { Rng } from '../core/rng';
import { chooseBehavior, COOLDOWN } from './selector';
import type { BehaviorChoice, BehaviorId, InterestKind } from './types';

export interface Senses {
  nearby: readonly InterestKind[];
  hunger: number;
}

export interface CurrentBehavior extends BehaviorChoice {
  startedAt: number;
}

/**
 * 자율 행동의 "무엇을 할지"만 결정한다.
 * 실제 이동과 애니메이션은 cat/ 모듈이 맡는다.
 */
export class BehaviorBrain {
  current: CurrentBehavior = { id: 'idle', duration: 2, startedAt: 0 };
  last: BehaviorId | null = null;
  activeTime = 0;
  cooldowns: Partial<Record<BehaviorId, number>> = {};

  constructor(private readonly rng: Rng) {}

  /** 행동이 바뀌었으면 true */
  update(dt: number, now: number, senses: Senses): boolean {
    const id = this.current.id;
    if (id === 'walk' || id === 'sniff') this.activeTime += dt;
    if (now - this.current.startedAt >= this.current.duration) {
      this.finishCurrent(now, senses);
      return true;
    }
    return false;
  }

  /** 현재 행동을 끝내고 다음 행동을 고른다. (예: 목적지 도착) */
  finishCurrent(now: number, senses: Senses): void {
    this.endCurrent(now);
    const next = chooseBehavior(
      { now, last: this.last, activeTime: this.activeTime, nearby: senses.nearby, hunger: senses.hunger, cooldowns: this.cooldowns },
      this.rng,
    );
    this.current = { ...next, startedAt: now };
  }

  /** 외부 사건(쓰다듬기, 직접 조작 종료 등)으로 행동을 바로 바꾼다. */
  interrupt(id: BehaviorId, duration: number, now: number): void {
    this.current = { id, duration, startedAt: now };
  }

  progress(now: number): number {
    return Math.min(1, Math.max(0, (now - this.current.startedAt) / this.current.duration));
  }

  private endCurrent(now: number): void {
    const id = this.current.id;
    const cd = COOLDOWN[id];
    if (cd !== undefined) this.cooldowns[id] = now + cd;
    if (id === 'nap') this.activeTime = 0;
    else if (id === 'sit' || id === 'groom') this.activeTime *= 0.6;
    this.last = id;
  }
}
