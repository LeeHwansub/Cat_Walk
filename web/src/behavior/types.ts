export type BehaviorId =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'lookAround'
  | 'sniff'
  | 'groom'
  | 'nap'
  | 'eat'
  // 포즈 (지시서 2단계 7번): 식빵, 옆으로 눕기, 배 보이고 눕기, 기지개, 꼬리 감고 엎드리기, 아저씨 앉기
  | 'loaf'
  | 'sideLie'
  | 'bellyUp'
  | 'stretch'
  | 'tailWrap'
  | 'manSit';

/** 애니메이터가 그리는 행동 (자율 행동 + 먹은 뒤 입 핥기). 멀티플레이로도 주고받는다 */
export type AnimBehavior = BehaviorId | 'lickLips';

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
  /** 접힌 귀(스코티시폴드): 아저씨 앉기를 더 자주 한다 */
  fold?: boolean;
}

export interface BehaviorChoice {
  id: BehaviorId;
  duration: number;
}

export const REST_BEHAVIORS: readonly BehaviorId[] = ['idle', 'sit', 'lookAround', 'nap', 'loaf', 'sideLie', 'bellyUp', 'tailWrap', 'manSit'];

/** 엎드리거나 누운 휴식: 일어난 뒤 기지개를 켠다 */
export const LYING_BEHAVIORS: readonly BehaviorId[] = ['nap', 'loaf', 'sideLie', 'bellyUp', 'tailWrap'];
