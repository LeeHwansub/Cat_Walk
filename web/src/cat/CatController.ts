import { resolveCircle, type CollisionWorld } from '../world/collision';

export const WALK_SPEED = 0.55;
const MANUAL_SPEED = 0.85;
const ACCEL = 1.6;
const TURN_RATE = 3.2;
const RADIUS = 0.16;

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

  constructor(
    private readonly world: CollisionWorld,
    /** 걷기 한 주기 거리 (모델 크기에 따라 달라진다) */
    public cycleLength: number,
    public scale = 1,
  ) {}

  /** 목표 지점으로 걷는다. 도착하면 true */
  walkTo(tx: number, tz: number, dt: number, stopDist = 0.25, maxSpeed = WALK_SPEED): boolean {
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
    this.accelerate(maxSpeed * this.scale * turnSlow * Math.max(0.35, arriveSlow), dt);
    this.advance(dt);
    return false;
  }

  /** 월드 기준 방향으로 직접 이동 (3인칭 직접 조작) */
  moveDirect(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.01) {
      this.brake(dt);
      return;
    }
    const diff = wrapAngle(Math.atan2(dirX, dirZ) - this.heading);
    this.turn(diff, dt, 1.6);
    this.accelerate(MANUAL_SPEED * this.scale * (Math.abs(diff) > 1.2 ? 0.35 : 1), dt);
    this.advance(dt);
  }

  /** 탱크식 이동: 좌우는 회전, 앞뒤는 전진 (캣캠 직접 조작) */
  moveTank(turnInput: number, forwardInput: number, dt: number): void {
    this.turnRate = -turnInput * TURN_RATE * 0.6;
    this.heading = wrapAngle(this.heading + this.turnRate * dt);
    if (forwardInput > 0.01) this.accelerate(MANUAL_SPEED * this.scale * 0.8, dt);
    else this.brake(dt);
    this.advance(dt);
  }

  /** 제자리에서 목표 방향으로 몸을 돌린다 */
  face(tx: number, tz: number, dt: number): void {
    const diff = wrapAngle(Math.atan2(tx - this.x, tz - this.z) - this.heading);
    this.turn(diff, dt, 0.5);
    this.brake(dt);
  }

  brake(dt: number): void {
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
    const step = ACCEL * this.scale * dt;
    this.speed += Math.max(-step * 2, Math.min(step, target - this.speed));
  }

  private advance(dt: number): void {
    if (this.speed < 1e-4) {
      this.speed = 0;
      return;
    }
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const r = resolveCircle(this.world, nx, nz, RADIUS * this.scale);
    const moved = Math.hypot(r.x - this.x, r.z - this.z);
    this.x = r.x;
    this.z = r.z;
    // 느리면 보폭이 줄고(애니메이터와 같은 비율), 빠르면 보폭은 그대로 두고 걸음이 빨라진다
    const norm = Math.min(1, Math.max(0.3, this.speed / (WALK_SPEED * this.scale)));
    this.gaitPhase = (this.gaitPhase + moved / (this.cycleLength * this.scale * norm)) % 1;
    // 벽에 막히면 실제 이동량에 맞춰 속도를 줄인다 (제자리 걸음 방지)
    if (dt > 0) this.speed = Math.min(this.speed, moved / dt + 0.05);
  }
}
