import { range, type Rng } from '../core/rng';

export type EatPhase = 'approach' | 'sniff' | 'eat' | 'lick' | 'done';

const SNIFF_SECONDS = 1;
const LICK_SECONDS = 1.2;

/**
 * 먹기 흐름: 그릇으로 다가가기 → 냄새 맡기 → 먹기(5~8초) → 입 핥기 → 조작 해제
 * (지시서 1단계 5번)
 * 다가가는 동안에는 이동을 잠그지 않는다(사용자가 다른 곳으로 가면 취소된다).
 * 그릇에 도착한 뒤부터 끝날 때까지는 이동 입력을 무시한다.
 */
export class EatingSequence {
  phase: EatPhase = 'approach';
  readonly eatDuration: number;
  private t = 0;

  constructor(rng: Rng) {
    this.eatDuration = range(rng, 5, 8);
  }

  /** 그릇에 도착 */
  arrive(): void {
    if (this.phase !== 'approach') return;
    this.phase = 'sniff';
    this.t = 0;
  }

  /** fed: 먹기를 마친 순간(배고픔 회복·그릇 비우기), done: 흐름이 끝난 순간 */
  update(dt: number): { fed: boolean; done: boolean } {
    if (this.phase === 'approach' || this.phase === 'done') return { fed: false, done: false };
    this.t += dt;
    if (this.phase === 'sniff' && this.t >= SNIFF_SECONDS) {
      this.next('eat');
    } else if (this.phase === 'eat' && this.t >= this.eatDuration) {
      this.next('lick');
      return { fed: true, done: false };
    } else if (this.phase === 'lick' && this.t >= LICK_SECONDS) {
      this.next('done');
      return { fed: false, done: true };
    }
    return { fed: false, done: false };
  }

  get locksMovement(): boolean {
    return this.phase === 'sniff' || this.phase === 'eat' || this.phase === 'lick';
  }

  get animBehavior(): 'walk' | 'sniff' | 'eat' | 'lickLips' | 'idle' {
    switch (this.phase) {
      case 'approach':
        return 'walk';
      case 'sniff':
        return 'sniff';
      case 'eat':
        return 'eat';
      case 'lick':
        return 'lickLips';
      default:
        return 'idle';
    }
  }

  private next(p: EatPhase): void {
    this.phase = p;
    this.t = 0;
  }
}
