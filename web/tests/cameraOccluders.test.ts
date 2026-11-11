import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildNeighborhood } from '../src/world/map/neighborhood';

// 지도의 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다). Node에는 document가 없다
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }),
};

/**
 * 몸을 막는 높은 벽은 카메라도 막아야 한다. 빠지면 카메라가 벽을 뚫고 들어가 벽 속·벽 너머가 보인다
 * (2026-11-07 옆 골목 이웃 벽·담장이 빠져 있었음)
 */
describe('카메라 가림 물체', () => {
  it('몸을 막는 물체가 높이 1.1m에도 있으면 카메라 가림 물체에 들어 있다', () => {
    const map = buildNeighborhood();
    map.group.updateMatrixWorld(true);
    const missing: string[] = [];
    const ray = new THREE.Raycaster();
    const inRect = (p: THREE.Vector3, r: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
      p.x >= r.minX - 0.01 && p.x <= r.maxX + 0.01 && p.z >= r.minZ - 0.01 && p.z <= r.maxZ + 0.01;
    for (const r of map.collision.rects) {
      const cx = (r.minX + r.maxX) / 2;
      const cz = (r.minZ + r.maxZ) / 2;
      // 높이 1.1m에서 충돌 영역을 수평으로 가로지른다 (x, z 두 방향). 공중의 차양·처마와 1m 이하 낮은 울타리는 걸리지 않는다
      for (const [o, d] of [
        [new THREE.Vector3(r.minX - 1, 1.1, cz), new THREE.Vector3(1, 0, 0)],
        [new THREE.Vector3(cx, 1.1, r.minZ - 1), new THREE.Vector3(0, 0, 1)],
      ] as const) {
        ray.set(o, d);
        const solid = ray.intersectObject(map.group, true).some((h) => inRect(h.point, r));
        const blocked = ray.intersectObjects(map.occluders, true).some((h) => inRect(h.point, r));
        if (solid && !blocked) {
          missing.push(`(${cx.toFixed(1)}, ${cz.toFixed(1)})`);
          break;
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
