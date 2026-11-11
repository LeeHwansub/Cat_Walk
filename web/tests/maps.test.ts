import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import { isFree, type CollisionWorld } from '../src/world/collision';
import { DEFAULT_MAP_ID, disposeMap, MAPS, mapById } from '../src/world/maps';
import { bakeModel, type PropModels } from '../src/world/propModels';
import { defaultSave } from '../src/save/storage';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

describe('맵 목록 (여러 맵, D-58 2단계)', () => {
  it('골목·공원 동네가 기본 맵이고, id가 겹치지 않는다', () => {
    expect(DEFAULT_MAP_ID).toBe('neighborhood');
    expect(MAPS.map((m) => m.id)).toContain(DEFAULT_MAP_ID);
    expect(new Set(MAPS.map((m) => m.id)).size).toBe(MAPS.length);
    for (const m of MAPS) expect(m.name.length).toBeGreaterThan(0);
  });

  it('모르는 id(지워진 맵·손상된 저장)는 기본 맵으로', () => {
    expect(mapById('nowhere').id).toBe(DEFAULT_MAP_ID);
    expect(mapById(DEFAULT_MAP_ID).id).toBe(DEFAULT_MAP_ID);
  });

  it('기본 저장의 맵은 기본 맵이다', () => {
    expect(defaultSave().mapId).toBe(DEFAULT_MAP_ID);
  });

  it('모든 맵은 출발점·먹이 쉼터·주민 자리가 비어 있다', () => {
    for (const def of MAPS) {
      const m = def.build({});
      expect(isFree(m.collision, m.spawn.x, m.spawn.z, 0.2), def.id).toBe(true);
      expect(isFree(m.collision, m.npcSpot.x, m.npcSpot.z, 0.2), def.id).toBe(true);
      expect(isFree(m.collision, m.foodStation.x, m.foodStation.z - 0.6, 0.2), def.id).toBe(true);
    }
  });
});

describe('맵 정리 (바꿀 때 이전 맵을 메모리에서 내린다)', () => {
  it('맵 도형·재질은 정리하고, 맵끼리 함께 쓰는 소품 모델은 남긴다', () => {
    const src = new THREE.Group();
    const g = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.5), 3));
    src.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true })));
    const models: PropModels = { bin: bakeModel(src, 1) };
    const model = models.bin as THREE.Mesh;
    const map = mapById(DEFAULT_MAP_ID).build(models);

    const disposed = new Set<unknown>();
    map.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.addEventListener('dispose', () => disposed.add(m.geometry));
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.addEventListener('dispose', () => disposed.add(mat));
    });
    let modelDisposed = false;
    model.geometry.addEventListener('dispose', () => (modelDisposed = true));
    (model.material as THREE.Material).addEventListener('dispose', () => (modelDisposed = true));

    const n = disposeMap(map, models);
    expect(n).toBeGreaterThan(10);
    expect(disposed.size).toBeGreaterThan(10);
    expect(modelDisposed).toBe(false);
  });
});

describe('고양이를 다른 맵으로 옮기기', () => {
  it('새 충돌 세계·위치로 옮기고, 점프·높이 상태를 바닥에서 새로 시작한다', () => {
    const wall: CollisionWorld = { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, rects: [{ minX: 0.3, maxX: 1, minZ: -1, maxZ: 1 }], circles: [] };
    const open: CollisionWorld = { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, rects: [], circles: [] };
    const c = new CatController(open, 0.4);
    c.y = 1.2;
    c.bodyY = 1.2;
    c.placeIn(wall, 0, 0, Math.PI / 2);
    expect(c.x).toBe(0);
    expect(c.heading).toBeCloseTo(Math.PI / 2);
    expect(c.y).toBe(0);
    expect(c.bodyY).toBe(0);
    for (let i = 0; i < 120; i++) c.moveDirect(1, 0, 1 / 60); // +x로 걸으면 새 세계의 벽에 막힌다
    expect(c.x).toBeLessThan(0.3);
  });
});
