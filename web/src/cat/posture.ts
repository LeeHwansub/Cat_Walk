import type { CatPose } from './pose';

/** 앉기·엎드리기 정도가 이 값을 넘으면 걸을 수 없다 (먼저 일어서야 한다) */
export const POSTURE_MOVE_THRESHOLD = 0.12;

/**
 * 이동은 걷기(선) 자세에서만 허용한다. (지시서 1단계 6번: 앉은 채로 걷기 금지)
 * 앉기·엎드리기 상태에서 이동이 필요하면, 호출하는 쪽이 이동을 멈추고 일어서기를 먼저 요청한다.
 */
export function postureBlocksMovement(p: Pick<CatPose, 'sit' | 'lie'>): boolean {
  return Math.max(p.sit, p.lie) > POSTURE_MOVE_THRESHOLD;
}
