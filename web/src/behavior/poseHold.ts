import { DURATION } from './selector';
import type { BehaviorChoice, BehaviorId } from './types';

/** "움직일 때까지" 유지하는 시간 (초, 사실상 끝나지 않음) */
export const POSE_HOLD = 1e9;

/** 끝이 있는 동작: 한 번 한 뒤 앉아서 기다린다 */
const ONE_SHOT: readonly BehaviorId[] = ['groom', 'stretch', 'lookAround'];

/**
 * 포즈 메뉴로 고른 자세 (사용자 결정 2026-11-09): 움직이거나 다른 자세를 고를 때까지 유지한다.
 * 그루밍·기지개·둘러보기는 보통 길이만큼 한 번 하고 앉기로 넘어간다
 */
export class PoseHold {
  id: BehaviorId | null = null;

  start(id: BehaviorId): BehaviorChoice {
    this.id = id;
    if (!ONE_SHOT.includes(id)) return { id, duration: POSE_HOLD };
    const [min, max] = DURATION[id];
    return { id, duration: (min + max) / 2 };
  }

  /** 행동 진행(0~1)을 보고, 한 번 하는 동작이 끝났으면 이어서 할 행동(앉기)을 돌려준다 */
  next(progress: number): BehaviorChoice | null {
    if (this.id === null || !ONE_SHOT.includes(this.id) || progress < 1) return null;
    this.id = 'sit';
    return { id: 'sit', duration: POSE_HOLD };
  }

  stop(): void {
    this.id = null;
  }
}
