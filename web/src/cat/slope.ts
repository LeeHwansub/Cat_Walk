import { groundAt, STEP_UP, type CollisionWorld } from '../world/collision';

/** 몸 반 길이 (앞발 ~ 뒷발의 절반, 성체 m). 이 길이에 걸쳐 바닥 높이를 잰다 */
export const BODY_HALF = 0.13;
/** 몸 기울기 한계 (rad) */
const MAX_PITCH = 0.7;

/**
 * 보이는 몸의 높이·기울기 (사용자 요청 2026-11-10: 계단을 "한 칸씩 툭툭" 오르던 것).
 * 판정 높이(y)는 계단 한 칸씩 바뀌므로, 몸 길이에 걸친 다섯 곳의 바닥 높이 평균을 몸 높이로, 앞뒤 차이를 기울기로 쓴다.
 * 계단 위에서는 경사로처럼 보이고, 평지에서는 y 그대로다. y와 턱(STEP_UP)보다 크게 다른 곳(높은 곳 가장자리 너머)은 y로 본다.
 * pitch > 0: 앞(머리)이 높다. heading 0 = +z, 앞 방향 = (sin h, cos h)
 */
export function bodyOnGround(world: CollisionWorld, x: number, z: number, y: number, heading: number, scale: number): { y: number; pitch: number } {
  const half = BODY_HALF * scale;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const hs: number[] = [];
  for (const t of [-1, -0.5, 0, 0.5, 1]) {
    const g = groundAt(world, x + fx * half * t, z + fz * half * t, y);
    hs.push(Math.abs(g - y) <= STEP_UP + 1e-6 ? g : y);
  }
  const back = (hs[0] + hs[1]) / 2;
  const front = (hs[3] + hs[4]) / 2;
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(front - back, 1.5 * half)));
  return { y: hs.reduce((s, h) => s + h, 0) / hs.length, pitch };
}
