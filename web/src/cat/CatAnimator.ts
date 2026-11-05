import type { BehaviorId } from '../behavior/types';
import { neutralPose, type CatPose } from './pose';

export interface AnimInput {
  behavior: BehaviorId;
  /** 현재 행동 진행률 0~1 */
  progress: number;
  /** 현재 행동 경과 시간 (초) */
  elapsed: number;
  /** 실제 이동 속도 (m/s) */
  speed: number;
  /** 방향 전환 속도 (rad/s), 머리가 먼저 돌아가게 하는 데 쓴다 */
  turnRate: number;
  gaitPhase: number;
  /** 쓰다듬기 반응 중 */
  petted: boolean;
}

const WALK_SPEED = 0.55;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

/**
 * 행동(무엇을)을 자세 목표값으로 바꾸고, 현재 자세를 목표값으로 부드럽게 옮긴다.
 * 자세가 갑자기 바뀌지 않게 하는 것이 자연스러운 움직임의 핵심이다. (기획서 19장)
 */
export class CatAnimator {
  readonly pose: CatPose = neutralPose();
  private lookSeed = Math.random() * 10;

  update(input: AnimInput, dt: number): CatPose {
    const t = this.target(input);
    const p = this.pose;
    const k = (rate: number) => 1 - Math.exp(-rate * dt);
    p.gaitPhase = input.gaitPhase;
    p.speed += (t.speed - p.speed) * k(8);
    p.sit += (t.sit - p.sit) * k(3);
    p.lie += (t.lie - p.lie) * k(1.8);
    p.headYaw += (t.headYaw - p.headYaw) * k(4);
    p.headPitch += (t.headPitch - p.headPitch) * k(4);
    p.headTilt += (t.headTilt - p.headTilt) * k(3);
    p.tailUp += (t.tailUp - p.tailUp) * k(2);
    p.tailWag += (t.tailWag - p.tailWag) * k(2);
    p.pawLift += (t.pawLift - p.pawLift) * k(5);
    p.pawToFace += (t.pawToFace - p.pawToFace) * k(4);
    p.lick += (t.lick - p.lick) * k(6);
    p.eyesClosed += (t.eyesClosed - p.eyesClosed) * k(t.eyesClosed > p.eyesClosed ? 1.2 : 5);
    return p;
  }

  private target(input: AnimInput): CatPose {
    const t = neutralPose();
    const moving = clamp01(input.speed / WALK_SPEED);
    t.speed = moving;
    t.headYaw = Math.max(-0.6, Math.min(0.6, input.turnRate * 0.35));
    t.tailUp = 0.55 + moving * 0.45;
    t.tailWag = 0.15 + moving * 0.15;

    const e = input.elapsed;
    switch (input.behavior) {
      case 'walk':
        t.headPitch = 0.12;
        break;
      case 'idle':
        t.headYaw += Math.sin(e * 0.4 + this.lookSeed) * 0.25;
        break;
      case 'lookAround':
        t.headYaw = Math.sin(e * 0.9 + this.lookSeed) * 0.85;
        t.headPitch = -0.12 + Math.sin(e * 0.5) * 0.1;
        t.tailWag = 0.3;
        break;
      case 'sniff':
        t.headPitch = 0.75;
        t.headYaw = Math.sin(e * 2.3) * 0.15;
        t.lick = 0.3;
        t.tailWag = 0.1;
        break;
      case 'sit':
        t.sit = 1;
        t.tailUp = 0;
        t.tailWag = 0.12;
        t.headYaw = Math.sin(e * 0.3 + this.lookSeed) * 0.4;
        break;
      case 'groom':
        this.groom(t, input.progress);
        break;
      case 'nap':
        t.lie = 1;
        t.tailUp = 0;
        t.tailWag = 0.02;
        t.headPitch = 0.35;
        t.headYaw = 0.45;
        t.headTilt = 0.2;
        t.eyesClosed = smooth(0.05, 0.2, input.progress) * (1 - smooth(0.92, 1, input.progress));
        break;
      case 'eat':
        t.headPitch = 0.95;
        t.lick = 1;
        t.tailUp = 0.4;
        t.tailWag = 0.1;
        break;
    }

    if (input.petted) {
      t.sit = Math.max(t.sit, 1);
      t.lie = 0;
      t.headPitch = -0.3;
      t.headTilt = 0.25;
      t.eyesClosed = 0.65;
      t.tailUp = 0.85;
      t.tailWag = 0.25;
      t.pawLift = 0;
    }
    return t;
  }

  /** 그루밍: 앉기 → 앞발 들기 → 앞발 핥기 → 얼굴 닦기 → 앞발 내리기 (기획서 5.2) */
  private groom(t: CatPose, prog: number): void {
    t.sit = 1;
    t.tailUp = 0;
    t.tailWag = 0.05;
    const lift = smooth(0.06, 0.16, prog) * (1 - smooth(0.88, 0.97, prog));
    const toFace = smooth(0.5, 0.6, prog);
    t.pawLift = lift;
    t.pawToFace = toFace;
    t.lick = lift * (1 - toFace * 0.6);
    t.headPitch = lerp(0.05, lerp(0.55, 0.2, toFace), lift);
    t.headTilt = toFace * 0.3 * lift;
    t.headYaw = -0.15 * lift;
    t.eyesClosed = 0.45 * lift;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
