export type BehaviorId = 'idle' | 'walk' | 'sit' | 'lookAround' | 'sniff' | 'groom' | 'nap' | 'eat';

/** 맵의 관심 지점 종류. 자율 행동이 주변 환경에 반응하는 근거가 된다. (기획서 5.4) */
export type InterestKind = 'grass' | 'flower' | 'pot' | 'car' | 'food' | 'sunspot' | 'bench' | 'pond';

export interface BehaviorContext {
  /** 현재 시각 (초) */
  now: number;
  /** 직전 행동 */
  last: BehaviorId | null;
  /** 마지막 휴식 이후 활동한 시간 (초) */
  activeTime: number;
  /** 고양이 주변에 있는 관심 지점 종류 */
  nearby: readonly InterestKind[];
  /** 0(배고픔) ~ 100(배부름) */
  hunger: number;
  /** 행동별로 이 시각 전까지는 선택하지 않는다 */
  cooldowns: Partial<Record<BehaviorId, number>>;
}

export interface BehaviorChoice {
  id: BehaviorId;
  duration: number;
}

export const REST_BEHAVIORS: readonly BehaviorId[] = ['idle', 'sit', 'lookAround', 'nap'];
