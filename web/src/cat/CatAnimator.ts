import type { JumpWeights } from './jump';
import type { AnimBehavior } from '../behavior/types';
import { runWeight, WALK_SPEED } from './CatController';
import type { GazeAngles } from './gaze';
import { neutralPose, type CatPose } from './pose';

/** 애니메이션 전용 동작: 먹은 뒤 입 핥기 */
export type { AnimBehavior };

export interface AnimInput {
  behavior: AnimBehavior;
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
  /** 이동하려고 일어서는 중: 앉기·엎드리기를 빠르게 풀고(0.3~0.5초) 다른 자세 요청보다 우선한다 */
  standingUp?: boolean;
  /** 풍선 이스터 에그: 떠 있는 정도 0~1 */
  floating?: number;
  /** 바라볼 대상의 방향 (없으면 null) */
  gaze?: GazeAngles | null;
  /** 점프 자세 비율 (CatController.jumpPose). 점프 단계가 빨라 지연 없이 그대로 쓴다 */
  jump?: JumpWeights;
}

/** 행동별로 시선 대상을 따르는 정도. 없는 행동(그루밍·먹기·냄새 맡기 등)은 자기 동작에 집중한다 */
const GAZE_WEIGHT: Partial<Record<AnimBehavior, number>> = {
  idle: 0.85,
  sit: 0.85,
  lookAround: 0.6,
  loaf: 0.75,
  manSit: 0.85,
  tailWrap: 0.5,
  walk: 0.35,
};
/** 눈동자가 머리 안에서 움직일 수 있는 한계 */
const MAX_EYE_YAW = 0.3;
const MAX_EYE_PITCH = 0.2;

/** 그루밍 핥기: 고개 숙임(rad), 까딱임 크기(rad)·빠르기(rad/s). 자세는 부드럽게 따라가므로 실제 까딱임은 이보다 작다 */
const GROOM_LICK_PITCH = 0.85;
const GROOM_BOB = 0.15;
const GROOM_BOB_RATE = 5;

/** 일어서기 속도. 앉은 자세(1)에서 이동 가능 기준(0.12)까지 약 0.35초 */
const STAND_UP_RATE = 6;

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
    // 달리기 비율: 속도에서 바로 정한다 (앉기·눕기 중에는 움직이지 않으므로 0)
    p.run += (runWeight(input.speed) - p.run) * k(6);
    p.sit += (t.sit - p.sit) * k(input.standingUp ? STAND_UP_RATE : 3);
    p.lie += (t.lie - p.lie) * k(input.standingUp ? STAND_UP_RATE : 1.8);
    p.headYaw += (t.headYaw - p.headYaw) * k(4);
    p.headPitch += (t.headPitch - p.headPitch) * k(4);
    p.headTilt += (t.headTilt - p.headTilt) * k(3);
    p.tailUp += (t.tailUp - p.tailUp) * k(2);
    p.tailWag += (t.tailWag - p.tailWag) * k(2);
    p.pawLift += (t.pawLift - p.pawLift) * k(5);
    p.pawToFace += (t.pawToFace - p.pawToFace) * k(4);
    p.groom += (t.groom - p.groom) * k(4);
    p.groomPhase = t.groomPhase;
    p.bellyUp += (t.bellyUp - p.bellyUp) * k(3);
    p.sideLie += (t.sideLie - p.sideLie) * k(3);
    p.loafPose += (t.loafPose - p.loafPose) * k(3);
    p.napPose += (t.napPose - p.napPose) * k(3);
    p.wrapPose += (t.wrapPose - p.wrapPose) * k(3);
    p.lick += (t.lick - p.lick) * k(6);
    p.eyesClosed += (t.eyesClosed - p.eyesClosed) * k(t.eyesClosed > p.eyesClosed ? 1.2 : 5);
    const up = input.standingUp;
    p.tuck += (t.tuck - p.tuck) * k(up ? STAND_UP_RATE : 2);
    p.roll += (t.roll - p.roll) * k(up ? STAND_UP_RATE : 1.5); // 몸을 굴리는 건 천천히
    p.stretch += (t.stretch - p.stretch) * k(up ? STAND_UP_RATE : 4);
    p.tailWrap += (t.tailWrap - p.tailWrap) * k(1.2);
    p.manSit += (t.manSit - p.manSit) * k(up ? STAND_UP_RATE : 2.5);
    p.eyeYaw += (t.eyeYaw - p.eyeYaw) * k(14); // 눈은 고개보다 먼저, 빠르게 움직인다
    p.eyePitch += (t.eyePitch - p.eyePitch) * k(14);
    p.float = input.floating ?? 0;
    p.jumpCrouch = input.jump?.crouch ?? 0;
    p.jumpLaunch = input.jump?.launch ?? 0;
    p.jumpAir = input.jump?.air ?? 0;
    p.jumpLand = input.jump?.land ?? 0;
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
        this.groom(t, input.progress, e);
        break;
      case 'nap':
        t.lie = 1;
        t.napPose = 1; // 자세 파일이 있으면 Blender로 만든 낮잠 자세
        t.tailUp = 0;
        t.tailWag = 0.02;
        t.headPitch = 0.35;
        t.headYaw = 0.45;
        t.headTilt = 0.2;
        t.eyesClosed = sleepyEyes(e, input.progress, 0.92);
        break;
      case 'eat':
        t.headPitch = 0.95;
        t.lick = 1;
        t.tailUp = 0.4;
        t.tailWag = 0.1;
        break;
      case 'loaf':
        // 식빵: 앞발을 가슴 아래로 접어 넣고 반쯤 눈을 감는다
        t.lie = 1;
        t.tuck = 1;
        t.loafPose = 1; // 자세 파일이 있으면 Blender로 만든 식빵 자세
        t.tailUp = 0;
        t.tailWag = 0.04;
        t.headPitch = 0.05;
        t.headYaw = Math.sin(e * 0.25 + this.lookSeed) * 0.25;
        t.eyesClosed = 0.35;
        break;
      case 'sideLie':
        t.lie = 1;
        t.roll = 0.5;
        t.sideLie = 1; // 자세 파일이 있으면 Blender로 만든 옆으로 눕기 자세
        t.tailUp = 0;
        t.tailWag = 0.05;
        t.headPitch = 0.1;
        t.eyesClosed = sleepyEyes(e, input.progress, 0.9) * 0.9;
        break;
      case 'bellyUp':
        // 배를 보이고 뒤집어 누움: 편안할 때만 보이는 자세. 고개를 옆으로 꺾고 꼬리를 살랑인다
        t.lie = 1;
        t.roll = 1;
        t.bellyUp = 1; // 자세 파일이 있으면 Blender로 만든 배 보이기 자세
        t.tailUp = 0;
        t.tailWag = 0.15;
        t.headTilt = 0.3;
        t.headYaw = 0.3;
        t.eyesClosed = 0.4;
        break;
      case 'stretch': {
        // 기지개: 앞다리를 쭉 뻗고 가슴을 낮춘 채 엉덩이는 들고, 눈을 지그시 감는다
        const s = smooth(0, 0.2, input.progress) * (1 - smooth(0.75, 1, input.progress));
        t.stretch = s;
        t.headPitch = -0.25 * s;
        t.eyesClosed = 0.7 * s;
        t.tailUp = 0.9;
        t.tailWag = 0.1;
        break;
      }
      case 'tailWrap':
        // 꼬리 감고 엎드리기: 꼬리로 몸을 감싸고 고개를 묻는다
        t.lie = 1;
        t.tuck = 0.6;
        t.tailWrap = 1;
        t.wrapPose = 1; // 자세 파일이 있으면 Blender로 만든 꼬리 감기 자세
        t.tailUp = 0;
        t.tailWag = 0.03;
        t.headPitch = 0.3;
        t.headYaw = 0.2;
        t.eyesClosed = sleepyEyes(e, input.progress, 0.92);
        break;
      case 'manSit':
        // 아저씨 앉기 (스코티시폴드): 엉덩이를 대고 상체를 세워 사람처럼 앉는다
        t.sit = 1;
        t.manSit = 1;
        t.tailUp = 0;
        t.tailWag = 0.08;
        t.headPitch = 0.05;
        t.headYaw = Math.sin(e * 0.3 + this.lookSeed) * 0.35;
        break;
      case 'lickLips':
        // 먹고 나서 고개를 들고 입 주변을 핥는다
        t.headPitch = -0.05;
        t.lick = 1;
        t.eyesClosed = 0.4;
        t.tailUp = 0.5;
        t.tailWag = 0.2;
        break;
    }

    // 시선: 쉬는 행동 중에는 관심 대상 쪽으로 고개를 돌리고, 남는 각도는 눈동자로 본다
    let gw = input.gaze && !input.petted ? (GAZE_WEIGHT[input.behavior] ?? 0) : 0;
    // 걷는 중(직접 조작 포함)에는 앞을 보며 힐끗 보는 정도만
    const walking = input.behavior === 'walk' || moving > 0.3;
    if (walking) gw = Math.min(gw, GAZE_WEIGHT.walk ?? 0);
    if (gw > 0 && input.gaze) {
      const headYawMax = walking ? 0.5 : 1;
      const wantYaw = Math.max(-headYawMax, Math.min(headYawMax, input.gaze.yaw));
      t.headYaw = lerp(t.headYaw, wantYaw, gw);
      t.headPitch = lerp(t.headPitch, t.headPitch + input.gaze.pitch * 0.6, gw);
      const open = 1 - t.eyesClosed;
      t.eyeYaw = Math.max(-MAX_EYE_YAW, Math.min(MAX_EYE_YAW, input.gaze.yaw - t.headYaw)) * open;
      t.eyePitch = Math.max(-MAX_EYE_PITCH, Math.min(MAX_EYE_PITCH, input.gaze.pitch * 0.4)) * open;
    }

    if (input.petted && !input.standingUp) {
      t.sit = Math.max(t.sit, 1);
      t.lie = 0;
      t.headPitch = -0.3;
      t.headTilt = 0.25;
      t.eyesClosed = 0.65;
      t.tailUp = 0.85;
      t.tailWag = 0.25;
      t.pawLift = 0;
      t.tuck = 0;
      t.roll = 0;
      t.stretch = 0;
      t.manSit = 0;
      t.groom = 0;
      t.bellyUp = 0;
      t.sideLie = 0;
      t.loafPose = 0;
      t.napPose = 0;
      t.wrapPose = 0;
    }
    const fl = input.floating ?? 0;
    if (fl > 0.01) {
      // 떠 있으면 앉거나 누울 수 없고, 다리는 늘어뜨린 채 꼬리만 살랑인다
      t.sit *= 1 - fl;
      t.lie *= 1 - fl;
      t.speed *= 1 - fl;
      t.pawLift *= 1 - fl;
      t.groom *= 1 - fl;
      t.bellyUp *= 1 - fl;
      t.sideLie *= 1 - fl;
      t.loafPose *= 1 - fl;
      t.napPose *= 1 - fl;
      t.wrapPose *= 1 - fl;
      t.tuck *= 1 - fl;
      t.roll *= 1 - fl;
      t.stretch *= 1 - fl;
      t.manSit *= 1 - fl;
      t.tailWrap *= 1 - fl;
      t.tailUp = t.tailUp * (1 - fl) + 0.75 * fl;
      t.tailWag = Math.max(t.tailWag, 0.35 * fl);
      t.headPitch = t.headPitch * (1 - fl) + 0.25 * fl; // 아래를 내려다본다
    }
    if (input.standingUp) {
      t.sit = 0;
      t.lie = 0;
      t.pawLift = 0;
      t.groom = 0;
      t.bellyUp = 0;
      t.sideLie = 0;
      t.loafPose = 0;
      t.napPose = 0;
      t.wrapPose = 0;
      t.tuck = 0;
      t.roll = 0;
      t.stretch = 0;
      t.manSit = 0;
    }
    return t;
  }

  /** 그루밍: 앉기 → 앞발 들기 → 앞발 핥기 → 얼굴 닦기 → 앞발 내리기 (기획서 5.2) */
  private groom(t: CatPose, prog: number, elapsed: number): void {
    t.sit = 1;
    t.tailUp = 0;
    t.tailWag = 0.05;
    const lift = smooth(0.06, 0.16, prog) * (1 - smooth(0.88, 0.97, prog));
    const toFace = smooth(0.5, 0.6, prog);
    t.pawLift = lift;
    t.pawToFace = toFace;
    // 옮겨 온 그루밍 동작(grumming.glb)은 쓰지 않는다: 몸이 엉거주춤해지고 턱이 벌어져 이·입속이 보였다 (사용자 결정 2026-11-09).
    // 바로 앉은 자세에서 앞발을 드는 코드 동작으로 한다. 입은 다문다
    t.groom = 0;
    t.groomPhase = prog;
    t.lick = 0;
    // 핥기: 고개를 앞발 쪽으로 숙이고 핥는 리듬으로 위아래로 까딱인다 (사용자 요청 2026-11-09). 얼굴 닦기 때는 덜 숙인다
    const licking = lift * (1 - toFace);
    const bob = Math.sin(elapsed * GROOM_BOB_RATE) * GROOM_BOB * licking;
    t.headPitch = lerp(0.05, lerp(GROOM_LICK_PITCH, 0.2, toFace), lift) + bob;
    t.headTilt = toFace * 0.3 * lift;
    t.headYaw = -0.15 * lift;
    t.eyesClosed = 0.75 * lift;
  }
}

/**
 * 누워 자는 자세의 눈: 누운 뒤 0.5~2초에 걸쳐 감고, 행동이 끝나갈 때(진행 wakeAt 이후) 뜬다.
 * 감는 때를 진행 비율이 아닌 경과 시간으로 정한다: 포즈 메뉴로 고른 자세는 끝이 없어 진행이 늘 0이다 (2026-11-09)
 */
function sleepyEyes(elapsed: number, progress: number, wakeAt: number): number {
  return smooth(0.5, 2, elapsed) * (1 - smooth(wakeAt, 1, progress));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
