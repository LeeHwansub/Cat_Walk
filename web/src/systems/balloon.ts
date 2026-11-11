import { BUILD_RANGE } from '../cat/appearance';

/**
 * 이스터 에그: 체형을 최대(통통 130%)로 키우면 풍선처럼 부풀어 떠다닌다. (사용자 요청 2026-11-05)
 */
export function isBalloon(build: number): boolean {
  return build >= BUILD_RANGE[1] - 1e-6;
}

/** 떠 있는 높이 (성체 기준, m). 크기에 비례한다 */
const FLOAT_HEIGHT = 1.2;
const BOB = 0.07;

/**
 * 떠오르기·둥실거리기·내려오기 높이 계산.
 * amount: 0(땅) ~ 1(완전히 떠 있음). 자세(다리 늘어뜨리기, 몸 부풀기)에 쓴다.
 */
export class BalloonFloat {
  amount = 0;

  /** 이번 프레임의 높이(m)를 돌려준다 */
  update(dt: number, time: number, active: boolean, scale: number): number {
    // 떠오를 때는 천천히, 내려올 때는 조금 더 천천히 (약 2~3초)
    const rate = active ? 0.9 : 0.7;
    this.amount += ((active ? 1 : 0) - this.amount) * (1 - Math.exp(-rate * dt));
    if (!active && this.amount < 0.002) this.amount = 0;
    const ease = this.amount * this.amount * (3 - 2 * this.amount);
    const bob = Math.sin(time * 1.6) * BOB * ease;
    return Math.max(0, (FLOAT_HEIGHT * ease + bob) * scale);
  }
}
