import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { isFree, pathClear } from '../src/world/collision';

// 지도의 캔버스 텍스처용 가짜 캔버스 (그리기는 아무것도 하지 않는다). Node에는 document가 없다
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

describe('골목 디테일 (3-1) 배치', () => {
  const map = buildNeighborhood();

  it('출발점·먹이 쉼터 앞·NPC 자리는 막히지 않는다', () => {
    expect(isFree(map.collision, map.spawn.x, map.spawn.z, 0.2)).toBe(true);
    expect(isFree(map.collision, map.npcSpot.x, map.npcSpot.z, 0.2)).toBe(true);
    expect(isFree(map.collision, map.foodStation.x, map.foodStation.z - 0.6, 0.2)).toBe(true);
  });

  it('큰길 가운데로 골목 끝에서 끝까지 지나갈 수 있다', () => {
    expect(pathClear(map.collision, -25, 0, 4.5, 0, 0.2)).toBe(true);
  });

  it('창틀·실외기·전선 같은 디테일이 생겼다 (전선은 튜브)', () => {
    let tubes = 0;
    map.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry instanceof THREE.TubeGeometry) tubes++;
    });
    // 구역 합치기 뒤에도 전선 재질 메시가 남아 있어야 한다 (합쳐지면 BufferGeometry가 되므로 재질 색으로 확인)
    let wireMat = 0;
    map.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if ((o as THREE.Mesh).isMesh && m?.color?.getHexString() === '2f3336') wireMat++;
    });
    expect(tubes + wireMat).toBeGreaterThan(0);
  });
});
