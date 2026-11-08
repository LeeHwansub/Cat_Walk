import { groundAt, resolveCircle, STEP_UP, type CollisionWorld } from '../world/collision';
import { airTime, findLanding, JUMP, jumpPoint, jumpWeights, type JumpPhase, type JumpWeights } from './jump';

// 걷기 속도 (m/s, 성체 기준). glb 모델의 걷기 클립 보폭에 맞춰 다리가 너무 빨리 움직이지 않게 낮춤 (2026-11-07 사용자 요청)
export const WALK_SPEED = 0.45;
const MANUAL_SPEED = 0.62;
/** 달리기 속도 (m/s, 성체 기준). 직접 조작 Shift, 자율은 배고플 때 그릇으로 (2026-11-07 사용자 요청) */
export const RUN_SPEED = 1.4;

/**
 * 달리기 동작 비율 0(걷기) ~ 1(달리기). speedScale로 나눈 성체 기준 속도로 판단해
 * 작은 고양이도 같은 상대 속도면 같은 동작을 한다.
 */
export function runWeight(speed: number, speedScale = 1): number {
  const v = speed / Math.max(1e-6, speedScale);
  // 직접 조작 걷기 속도(MANUAL_SPEED)까지는 걷기 동작만, 그보다 빠르면 달리기를 섞는다
  const from = MANUAL_SPEED * 1.1;
  const t = (v - from) / (RUN_SPEED * 0.9 - from);
  return Math.min(1, Math.max(0, t));
}
const ACCEL = 1.6;
const TURN_RATE = 3.2;
const RADIUS = 0.16;
/** 턱(STEP_UP 이하)을 오르내릴 때 높이를 따라가는 빠르기 (m/s). 계단 한 칸이 약 0.1초 */
const STEP_RATE = 1.5;
/** 중력 가속도 (m/s²) */
export const GRAVITY = 9.8;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * 고양이의 위치·방향·속도. "어떻게 움직일지"만 담당한다.
 * 방향(heading) 0 = +z, 앞 방향 벡터 = (sin h, cos h)
 */
export class CatController {
  x = 0;
  z = 0;
  heading = 0;
  speed = 0;
  turnRate = 0;
  gaitPhase = 0;
  /** 발 높이 (m). 0 = 바닥. 계단·담 위 (J-1, docs/10-jump-plan.md) */
  y = 0;
  /** 세로 속도 (m/s, 위 +). 턱보다 큰 높이에서 떨어질 때(점프 착지) 쓴다 */
  vy = 0;
  /** 진행 중인 점프 (J-2). 점프 중에는 이동 입력을 받지 않는다 */
  private jumpState: { phase: JumpPhase; t: number; air: number; x0: number; z0: number; y0: number; x1: number; z1: number; y1: number; lead: number } | null = null;

  constructor(
    private readonly world: CollisionWorld,
    /** 걷기 한 주기 거리 (모델 크기에 따라 달라진다) */
    public cycleLength: number,
    public scale = 1,
  ) {}

  /** 체형(통통할수록 옆으로 넓다). 충돌 반경에 반영 */
  girth = 1;
  /** 속도 추가 배율 (풍선으로 떠 있을 때 느리게) */
  speedMul = 1;
  /** 직접 조작에서 달리기 (Shift) */
  running = false;

  /**
   * 속도 배율. 보폭은 크기에 비례하지만 속도는 덜 줄여서(크기^0.6)
   * 작은 고양이일수록 걸음이 잦은 종종걸음이 된다.
   */
  get speedScale(): number {
    return Math.pow(this.scale, 0.6) * this.speedMul;
  }

  get jumping(): boolean {
    return this.jumpState !== null;
  }

  /**
   * 점프: 앞에 올라설 곳이 있으면 그 위로, 높은 곳이면 앞쪽 낮은 땅으로, 둘 다 없으면 제자리에서 짧게 뛴다.
   * 이미 뛰는 중이면 false
   */
  jump(): boolean {
    if (this.jumpState) return false;
    const r = RADIUS * this.scale * Math.sqrt(this.girth);
    const to = findLanding(this.world, this.x, this.z, this.y, this.heading, this.scale, r) ?? { x: this.x, z: this.z, y: this.y, lead: 0 };
    const dist = Math.hypot(to.x - this.x, to.z - this.z);
    const air = dist < 1e-3 ? JUMP.hop : airTime(dist, to.y - this.y, this.scale);
    this.jumpState = { phase: 'crouch', t: 0, air, x0: this.x, z0: this.z, y0: this.y, x1: to.x, z1: to.z, y1: to.y, lead: to.lead };
    this.speed = 0;
    this.vy = 0;
    return true;
  }

  /** 점프 자세 비율 (점프 중이 아니면 모두 0) */
  jumpPose(): JumpWeights {
    const j = this.jumpState;
    if (!j) return { crouch: 0, launch: 0, air: 0, land: 0 };
    const len = j.phase === 'crouch' ? JUMP.crouch : j.phase === 'land' ? JUMP.land : j.air;
    return jumpWeights(j.phase, j.t / len);
  }

  /** 점프 한 프레임: 웅크리기(제자리) → 공중(포물선) → 착지(제자리) */
  private stepJump(dt: number): void {
    const j = this.jumpState!;
    j.t += dt;
    if (j.phase === 'crouch') {
      if (j.t >= JUMP.crouch) {
        j.phase = 'air';
        j.t = 0;
      }
      return;
    }
    if (j.phase === 'air') {
      const t = Math.min(1, j.t / j.air);
      const q = jumpPoint(j.x0, j.z0, j.y0, j.x1, j.z1, j.y1, j.lead, t, this.scale);
      this.x = q.x;
      this.z = q.z;
      this.y = q.y;
      if (t >= 1) {
        this.y = j.y1;
        j.phase = 'land';
        j.t = 0;
      }
      return;
    }
    if (j.t >= JUMP.land) this.jumpState = null;
  }

  /** 목표 지점으로 걷는다. 도착하면 true */
  walkTo(tx: number, tz: number, dt: number, stopDist = 0.25, maxSpeed = WALK_SPEED): boolean {
    if (this.jumpState) {
      this.stepJump(dt);
      return false;
    }
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < stopDist) {
      this.brake(dt);
      return true;
    }
    const diff = wrapAngle(Math.atan2(dx, dz) - this.heading);
    this.turn(diff, dt);
    // 크게 돌아야 하면 천천히, 도착 직전에도 천천히
    const turnSlow = Math.abs(diff) > 1 ? 0.3 : 1;
    const arriveSlow = Math.min(1, dist / 0.6);
    this.accelerate(maxSpeed * this.speedScale * turnSlow * Math.max(0.35, arriveSlow), dt);
    this.advance(dt);
    return false;
  }

  /** 월드 기준 방향으로 직접 이동 (3인칭 직접 조작) */
  moveDirect(dirX: number, dirZ: number, dt: number): void {
    if (this.jumpState) return this.stepJump(dt);
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.01) {
      this.brake(dt);
      return;
    }
    const diff = wrapAngle(Math.atan2(dirX, dirZ) - this.heading);
    this.turn(diff, dt, 1.6);
    const top = this.running ? RUN_SPEED : MANUAL_SPEED;
    this.accelerate(top * this.speedScale * (Math.abs(diff) > 1.2 ? 0.35 : 1), dt);
    this.advance(dt);
  }

  /** 탱크식 이동: 좌우는 회전, 앞뒤는 전진 (캣캠 직접 조작) */
  moveTank(turnInput: number, forwardInput: number, dt: number): void {
    if (this.jumpState) return this.stepJump(dt);
    this.turnRate = -turnInput * TURN_RATE * 0.6;
    this.heading = wrapAngle(this.heading + this.turnRate * dt);
    if (forwardInput > 0.01) this.accelerate((this.running ? RUN_SPEED : MANUAL_SPEED) * this.speedScale * 0.8, dt);
    else this.brake(dt);
    this.advance(dt);
  }

  /** 제자리에서 목표 방향으로 몸을 돌린다 */
  face(tx: number, tz: number, dt: number): void {
    if (this.jumpState) return this.stepJump(dt);
    const diff = wrapAngle(Math.atan2(tx - this.x, tz - this.z) - this.heading);
    this.turn(diff, dt, 0.5);
    this.brake(dt);
  }

  brake(dt: number): void {
    if (this.jumpState) return this.stepJump(dt);
    this.accelerate(0, dt);
    this.turnRate *= Math.exp(-6 * dt);
    this.advance(dt);
  }

  private turn(diff: number, dt: number, mult = 1): void {
    const max = TURN_RATE * mult * dt;
    const step = Math.max(-max, Math.min(max, diff * 4 * dt));
    this.turnRate = step / Math.max(dt, 1e-4);
    this.heading = wrapAngle(this.heading + step);
  }

  private accelerate(target: number, dt: number): void {
    const step = ACCEL * this.speedScale * dt;
    this.speed += Math.max(-step * 2, Math.min(step, target - this.speed));
  }

  /**
   * 높이를 땅에 맞춘다: 턱 이하 차이는 STEP_RATE로 따라가고(계단), 그보다 높이 떠 있으면 중력으로 떨어진다.
   * 평지(땅 0, y 0)에서는 아무것도 바뀌지 않는다
   */
  updateVertical(dt: number): void {
    const g = groundAt(this.world, this.x, this.z, this.y);
    if (this.vy === 0 && Math.abs(this.y - g) <= STEP_UP + 1e-6) {
      this.y = g > this.y ? Math.min(g, this.y + STEP_RATE * dt) : Math.max(g, this.y - STEP_RATE * dt);
      return;
    }
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= g) {
      this.y = g;
      this.vy = 0;
    }
  }

  /** 이 높이에서 (x, z)로 갈 때 발밑이 턱보다 깊게 꺼지는지 (높은 곳 가장자리) */
  private dropsAt(x: number, z: number): boolean {
    return groundAt(this.world, x, z, this.y) < this.y - STEP_UP - 1e-6;
  }

  private advance(dt: number): void {
    this.updateVertical(dt);
    if (this.speed < 1e-4) {
      this.speed = 0;
      return;
    }
    const dx = Math.sin(this.heading) * this.speed * dt;
    const dz = Math.cos(this.heading) * this.speed * dt;
    const rad = RADIUS * this.scale * Math.sqrt(this.girth);
    let r = resolveCircle(this.world, this.x + dx, this.z + dz, rad, this.y);
    // 높은 곳 가장자리에서는 떨어지지 않는다: 한 축씩 미끄러져 보고, 그래도 안 되면 멈춘다 (내려가려면 점프, J-2)
    if (this.y > 0 && this.dropsAt(r.x, r.z)) {
      const tries = [resolveCircle(this.world, this.x + dx, this.z, rad, this.y), resolveCircle(this.world, this.x, this.z + dz, rad, this.y)];
      r = tries.find((t) => !this.dropsAt(t.x, t.z)) ?? { x: this.x, z: this.z };
    }
    const moved = Math.hypot(r.x - this.x, r.z - this.z);
    this.x = r.x;
    this.z = r.z;
    // 느리면 보폭이 줄고(애니메이터와 같은 비율), 빠르면 보폭은 그대로 두고 걸음이 빨라진다
    const norm = Math.min(1, Math.max(0.3, this.speed / (WALK_SPEED * this.speedScale)));
    this.gaitPhase = (this.gaitPhase + moved / (this.cycleLength * this.scale * norm)) % 1;
    // 벽에 막히면 실제 이동량에 맞춰 속도를 줄인다 (제자리 걸음 방지)
    if (dt > 0) this.speed = Math.min(this.speed, moved / dt + 0.05);
  }
}
