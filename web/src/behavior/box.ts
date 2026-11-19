import type { BehaviorId } from './types';

/**
 * 상자에 쏙 (눈 오는 광장 자동 반응, 보드 X-05): 빈 상자 안에서 멈춰 있으면 몸을 말아 앉는다.
 * 상자 안쪽 바닥은 턱(STEP_UP 0.2m)보다 높아 걸어서는 못 들어가고 뛰어 들어간다. 그 높이에서 앉으면
 * 귀와 눈만 상자 벽(0.4m) 위로 보인다
 */

/** 상자 안쪽 바닥 높이 (m) */
export const BOX_FLOOR = 0.24;
/** 상자 안에서 이만큼 멈춰 있으면 앉는다 (초) */
export const BOX_SIT_DELAY = 1.5;
/** 이보다 느리면 멈춘 것으로 본다 (m/s) */
const STILL_SPEED = 0.05;

/** 상자 안에서 멈춰 있은 시간: 상자 밖이거나 움직이면 0부터 */
export function nextBoxStill(prev: number, dt: number, inBox: boolean, speed: number): number {
  return inBox && speed < STILL_SPEED ? prev + dt : 0;
}

/**
 * 자동 생활에서 상자 안에 그대로 있을까: 쉬는 동안에는 머물고, 걷기로 바뀌면 폴짝 나온다.
 * 상자 안쪽 바닥(0.24m)이 턱(0.2m)보다 높아, 이것이 없으면 "높은 곳이면 먼저 뛰어내리기"가 계속 상자 안에서 뛴다
 */
export function staysInBox(inBox: boolean, behavior: BehaviorId): boolean {
  return inBox && behavior !== 'walk';
}
