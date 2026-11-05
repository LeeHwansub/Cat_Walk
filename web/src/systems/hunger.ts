/**
 * 배고픔은 힐링 경험을 보조할 뿐 압박 요소가 아니다. (기획서 8.3)
 * 0이 되어도 아무 제한이 없고, 값은 HUD 표시와 먹기 행동 선택에만 쓰인다.
 */
export type ActivityState = 'active' | 'rest' | 'nap';

/** 초당 감소량. 활동 중 기준 100 → 0까지 약 17분 */
export const HUNGER_RATE: Record<ActivityState, number> = {
  active: 0.1,
  rest: 0.04,
  nap: 0.015,
};

export const FEED_AMOUNT = 45;

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function tickHunger(value: number, dt: number, state: ActivityState): number {
  return clamp(value - HUNGER_RATE[state] * dt);
}

export function feed(value: number, amount = FEED_AMOUNT): number {
  return clamp(value + amount);
}

export function hungerLabel(value: number): string {
  if (value >= 70) return '배부름';
  if (value >= 30) return '보통';
  return '출출함';
}
