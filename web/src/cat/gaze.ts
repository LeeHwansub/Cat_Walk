import { range, type Rng } from '../core/rng';

/**
 * 시선: 고양이가 주변의 관심 대상(화분, 차, 주민 등)을 바라보게 한다. (지시서 2단계 1번 "주변을 바라보는 고개 돌림")
 * 무엇을 볼지(GazePicker)와 어느 각도인지(gazeAngles)만 정하고, 실제 고개·눈 움직임은 CatAnimator가 맡는다.
 */
export interface GazePoint {
  x: number;
  y: number;
  z: number;
}

export interface GazeAngles {
  /** 몸 방향 기준 좌우 (+ 왼쪽) */
  yaw: number;
  /** + 아래 */
  pitch: number;
}

/** 고개(+눈)로 돌릴 수 있는 한계 */
export const MAX_GAZE_YAW = 1.3;
const MAX_GAZE_PITCH = 0.6;
/** 이 거리 안의 대상만 본다 (m) */
const GAZE_RANGE = 6;
/** 몸 정면 기준 이 각도 밖(등 뒤)의 대상은 고르지 않는다 */
const GAZE_FOV = 1.9;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export interface CatView {
  x: number;
  z: number;
  /** 0 = +z, 앞 방향 = (sin h, cos h) */
  heading: number;
  /** 눈 높이 (m) */
  eyeY: number;
}

export function gazeAngles(cat: CatView, t: GazePoint): GazeAngles {
  const dx = t.x - cat.x;
  const dz = t.z - cat.z;
  const yaw = wrap(Math.atan2(dx, dz) - cat.heading);
  const pitch = Math.atan2(cat.eyeY - t.y, Math.hypot(dx, dz));
  return { yaw: clamp(yaw, MAX_GAZE_YAW), pitch: clamp(pitch, MAX_GAZE_PITCH) };
}

/** 한 대상을 몇 초 바라보다가 다른 대상으로 옮기거나, 잠깐 아무것도 보지 않는다 */
export class GazePicker {
  private target: GazePoint | null = null;
  private until = 0;

  constructor(private readonly rng: Rng) {}

  update<T extends GazePoint>(now: number, cat: CatView, candidates: readonly T[]): T | null {
    const visible = (p: GazePoint) => {
      const d = Math.hypot(p.x - cat.x, p.z - cat.z);
      return d > 0.3 && d < GAZE_RANGE && Math.abs(wrap(Math.atan2(p.x - cat.x, p.z - cat.z) - cat.heading)) < GAZE_FOV;
    };
    // 보던 대상이 시야를 벗어나면 바로 바꾼다
    if (this.target && !visible(this.target)) this.until = now;
    if (now >= this.until) {
      const pool = candidates.filter(visible).filter((p) => p !== this.target);
      if (pool.length === 0 || this.rng() < 0.3) {
        this.target = null;
        this.until = now + range(this.rng, 1.5, 3.5);
      } else {
        // 가까운 대상일수록 잘 고른다
        const w = pool.map((p) => 1 / (0.5 + Math.hypot(p.x - cat.x, p.z - cat.z)));
        let r = this.rng() * w.reduce((a, b) => a + b, 0);
        let pick = pool[0];
        for (let i = 0; i < pool.length; i++) {
          r -= w[i];
          if (r < 0) {
            pick = pool[i];
            break;
          }
        }
        this.target = pick;
        this.until = now + range(this.rng, 2, 5);
      }
    }
    return this.target as T | null;
  }
}
