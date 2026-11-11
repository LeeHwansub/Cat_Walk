import type { MapKit } from './kit';

/** 외부 계단 (J-4, docs/10-jump-plan.md 3-5): 벽에 붙어 +z 쪽으로 오르는 콘크리트 계단 + 현관 앞 바닥 + 난간 + 현관문 */
export interface ExteriorStairs {
  /** 벽 쪽 x (계단은 wallX ~ wallX + width) */
  wallX: number;
  width: number;
  /** 첫 칸이 시작하는 z */
  z0: number;
  /** 현관 바닥 높이 (m) */
  height: number;
  steps: number;
  /** 한 칸 깊이 (m) */
  tread: number;
  /** 현관 앞 바닥 깊이 (m) */
  landing: number;
}

const RAIL_H = 0.9;
const RAIL_T = 0.05;

/**
 * 칸마다 윗면이 있는 충돌(칸 높이 height/steps는 턱 STEP_UP보다 낮아 걸어서 오른다),
 * 골목 쪽 가장자리와 현관 앞 바닥 끝에는 윗면 없는 난간 충돌(떨어지거나 뛰어내리지 못하게).
 * 무작위 값을 쓰지 않는다 (뒤에 오는 배치의 무작위 순서가 바뀌지 않게)
 */
export function exteriorStairs(k: MapKit, s: ExteriorStairs): void {
  const concrete = k.mat('#b8b2a8', 0.95);
  const metal = k.mat('#55595c', 0.5);
  const door = k.mat('#6e4a32', 0.7);
  const x0 = s.wallX;
  const x1 = s.wallX + s.width;
  const cx = (x0 + x1) / 2;
  const rise = s.height / s.steps;
  for (let i = 0; i < s.steps; i++) {
    const za = s.z0 + i * s.tread;
    const top = (i + 1) * rise;
    k.occluders.push(k.box(s.width, top, s.tread, concrete, cx, top / 2, za + s.tread / 2));
    k.solidRect(x0, x1, za, za + s.tread, top);
  }
  const zl = s.z0 + s.steps * s.tread;
  const zEnd = zl + s.landing;
  k.occluders.push(k.box(s.width, s.height, s.landing, concrete, cx, s.height / 2, zl + s.landing / 2));
  k.solidRect(x0, x1, zl, zEnd, s.height);

  // 난간: 골목 쪽(계단 + 현관 앞) 한 줄, 현관 앞 끝(북쪽) 한 줄. 충돌은 윗면 없음
  const rx = x1 - RAIL_T / 2 - 0.02;
  k.solidRect(rx - RAIL_T / 2 - 0.01, rx + RAIL_T / 2 + 0.01, s.z0, zEnd);
  k.solidRect(x0, x1, zEnd - RAIL_T - 0.02, zEnd);
  const runLen = s.steps * s.tread;
  const slope = Math.atan2(s.height, runLen);
  // 난간도 몸을 막으므로 카메라도 막는다 (cameraOccluders 테스트)
  const rail = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = k.box(w, h, d, metal, x, y, z);
    k.occluders.push(m);
    return m;
  };
  const hand = rail(RAIL_T, RAIL_T, Math.hypot(runLen, s.height), rx, s.height / 2 + RAIL_H, s.z0 + runLen / 2);
  hand.rotation.x = -slope;
  for (let i = 0; i <= s.steps; i += 3) {
    const z = s.z0 + Math.min(i, s.steps - 0.5) * s.tread + s.tread / 2;
    const base = Math.min(i + 1, s.steps) * rise;
    rail(RAIL_T, RAIL_H, RAIL_T, rx, base + RAIL_H / 2, z);
  }
  rail(RAIL_T, RAIL_T, s.landing, rx, s.height + RAIL_H, zl + s.landing / 2);
  rail(RAIL_T, RAIL_H, RAIL_T, rx, s.height + RAIL_H / 2, zEnd - RAIL_T / 2);
  rail(s.width, RAIL_T, RAIL_T, cx, s.height + RAIL_H, zEnd - RAIL_T / 2);
  rail(RAIL_T, RAIL_H, RAIL_T, x0 + RAIL_T, s.height + RAIL_H / 2, zEnd - RAIL_T / 2);

  // 현관문 (벽 면에 붙임) + 작은 차양
  k.box(0.06, 2.0, 0.9, door, x0 + 0.03, s.height + 1.0, zl + s.landing / 2);
  k.box(0.6, 0.06, 1.2, concrete, x0 + 0.3, s.height + 2.3, zl + s.landing / 2);
}
