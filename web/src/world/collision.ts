/**
 * 물리 엔진 없이 XZ 평면 2D 충돌만 처리한다. (04 보고서 6절: 맵 충돌 단순화)
 * 고양이는 반지름 r인 원으로 취급한다.
 */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

export interface CollisionWorld {
  bounds: Rect;
  rects: Rect[];
  circles: Circle[];
}

export function resolveCircle(world: CollisionWorld, x: number, z: number, r: number): { x: number; z: number } {
  // 두 번 반복하면 사각형 두 개가 맞닿은 구석에서도 안정적으로 빠져나온다
  for (let iter = 0; iter < 2; iter++) {
    for (const rect of world.rects) {
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

export function isFree(world: CollisionWorld, x: number, z: number, r: number): boolean {
  const b = world.bounds;
  if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return false;
  for (const rect of world.rects) {
    const cx = Math.min(Math.max(x, rect.minX), rect.maxX);
    const cz = Math.min(Math.max(z, rect.minZ), rect.maxZ);
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  for (const c of world.circles) {
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false;
  }
  return true;
}
