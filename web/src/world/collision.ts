/**
 * 물리 엔진 없이 XZ 평면 2D 충돌만 처리한다. (04 보고서 6절: 맵 충돌 단순화)
 * 고양이는 반지름 r인 원으로 취급한다.
 * 높이 (J-0, docs/10-jump-plan.md): 물체마다 윗면 높이 top을 둘 수 있다.
 * - top 없음: 올라설 수 없는 물체(건물·나무·화분·철망 담·차 실내). 어느 높이에서도 막는다
 * - top 있음: 고양이 높이 y + STEP_UP 이하면 막지 않는다(그 위에 서 있거나 걸어 오른다)
 */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** 윗면 높이 (m). 없으면 올라설 수 없다 */
  top?: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
  /** 윗면 높이 (m). 없으면 올라설 수 없다 */
  top?: number;
}

/** 걸어서 넘는 턱 높이 (m). 계단 한 칸(약 0.17m)보다 크게: 계단은 걸어서 오른다 (결정 3) */
export const STEP_UP = 0.2;

/** 높이 y에 있는 고양이를 이 물체가 막는지 */
function blocks(top: number | undefined, y: number): boolean {
  return top === undefined || top > y + STEP_UP;
}

export interface CollisionWorld {
  bounds: Rect;
  rects: Rect[];
  circles: Circle[];
}

/** (x, z)에서 높이 y인 고양이가 설 땅 높이: 발밑 윗면 중 y + STEP_UP 이하인 가장 높은 것, 없으면 0 */
export function groundAt(world: CollisionWorld, x: number, z: number, y: number): number {
  let g = 0;
  for (const rect of world.rects) {
    if (rect.top === undefined || rect.top > y + STEP_UP || rect.top <= g) continue;
    if (x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) g = rect.top;
  }
  for (const c of world.circles) {
    if (c.top === undefined || c.top > y + STEP_UP || c.top <= g) continue;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r) g = c.top;
  }
  return g;
}

/** y: 고양이 발 높이 (기본 0 = 바닥, 이때는 높이가 생기기 전과 똑같이 막는다) */
export function resolveCircle(world: CollisionWorld, x: number, z: number, r: number, y = 0): { x: number; z: number } {
  // 두 번 반복하면 사각형 두 개가 맞닿은 구석에서도 안정적으로 빠져나온다
  for (let iter = 0; iter < 2; iter++) {
    for (const rect of world.rects) {
      if (!blocks(rect.top, y)) continue;
      const cx = Math.min(Math.max(x, rect.minX), rect.maxX);
      const cz = Math.min(Math.max(z, rect.minZ), rect.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // 중심이 사각형 안: 가장 가까운 변 바깥으로
        const pushes = [
          { d: x - rect.minX, x: rect.minX - r, z },
          { d: rect.maxX - x, x: rect.maxX + r, z },
          { d: z - rect.minZ, x, z: rect.minZ - r },
          { d: rect.maxZ - z, x, z: rect.maxZ + r },
        ];
        pushes.sort((a, b) => a.d - b.d);
        x = pushes[0].x;
        z = pushes[0].z;
      }
    }
    for (const c of world.circles) {
      if (!blocks(c.top, y)) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const min = c.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 1e-6;
      x = c.x + (dx / d) * min;
      z = c.z + (dz / d) * min;
    }
  }
  const b = world.bounds;
  x = Math.min(Math.max(x, b.minX + r), b.maxX - r);
  z = Math.min(Math.max(z, b.minZ + r), b.maxZ - r);
  return { x, z };
}

export function isFree(world: CollisionWorld, x: number, z: number, r: number, y = 0): boolean {
  const b = world.bounds;
  if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return false;
  for (const rect of world.rects) {
    if (!blocks(rect.top, y)) continue;
    const cx = Math.min(Math.max(x, rect.minX), rect.maxX);
    const cz = Math.min(Math.max(z, rect.minZ), rect.maxZ);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  for (const c of world.circles) {
    if (!blocks(c.top, y)) continue;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
  }
  return true;
}

/**
 * a에서 b까지 반지름 r인 고양이가 직선으로 막힘없이 갈 수 있는지 (step 간격으로 확인).
 * 자동 모드가 벽 너머를 목표로 골라 벽에 붙어 미끄러지던 것을 막는다 (2026-11-08)
 */
export function pathClear(world: CollisionWorld, ax: number, az: number, bx: number, bz: number, r: number, y = 0, step = 0.1): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!isFree(world, ax + (bx - ax) * t, az + (bz - az) * t, r, y)) return false;
  }
  return true;
}
