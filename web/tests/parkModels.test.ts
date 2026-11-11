import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { CatController } from '../src/cat/CatController';
import { createRng } from '../src/core/rng';
import { MapKit } from '../src/world/parts/kit';
import { bench } from '../src/world/parts/props';
import { isFree, pathClear } from '../src/world/collision';
import { bakeModel, PROP_SPECS, type PropId, type PropModels } from '../src/world/propModels';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

/** 모든 소품을 0.5m 정육면체 모델로 대신한 가짜 모델 묶음 (불러오기 없이 "모델이 있을 때"를 시험) */
function fakeModels(): PropModels {
  const out: PropModels = {};
  for (const id of Object.keys(PROP_SPECS) as PropId[]) {
    const g = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.5), 3));
    const src = new THREE.Group();
    src.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true })));
    out[id] = bakeModel(src, 1);
  }
  return out;
}

describe('공원 소품 모델 (Nature & Forest, 2026-11-10)', () => {
  const plain = buildNeighborhood();
  const map = buildNeighborhood(fakeModels());

  it('모델이 있으면 나무(참나무·단풍나무·자작나무)·벤치·덤불·돌·통나무·가로등·새집이 놓인다', () => {
    const ids = new Set<string>();
    map.group.traverse((o) => o.userData.prop && ids.add(o.userData.prop));
    for (const id of ['oak', 'maple', 'birch', 'parkBench', 'bush', 'rockS', 'rockM', 'fallenLog', 'lanternPost', 'birdhouse']) expect(ids, id).toContain(id);
  });

  it('들꽃·풀 포기·고사리는 종류마다 한 번에 그린다 (InstancedMesh)', () => {
    const scattered = new Map<string, number>();
    map.group.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh && o.userData.prop) scattered.set(o.userData.prop, (o as THREE.InstancedMesh).count);
    });
    for (const id of ['wildflower', 'grassTuft', 'fern']) expect(scattered.get(id) ?? 0, id).toBeGreaterThan(5);
  });

  it('모델이 없을 때와 다른 배치(배경 아파트 등)는 그대로다: 무작위 순서를 건드리지 않는다', () => {
    const rectsOf = (m: typeof map) => m.collision.rects.filter((r) => r.minX > 24 || r.maxX < -26 || r.minZ > 14 || r.maxZ < -14).length;
    expect(rectsOf(map)).toBe(rectsOf(plain));
    // 나무·벤치의 충돌은 모델이 있어도 같다
    const park = (m: typeof map) => m.collision.circles.filter((c) => c.x > 5).map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)},${c.r.toFixed(2)}`);
    for (const c of park(plain)) expect(park(map)).toContain(c);
  });

  it('쓰러진 통나무는 고양이가 올라설 수 있다', () => {
    const logs = map.collision.rects.filter((r) => r.minX > 5 && r.top !== undefined && r.top > 0.2 && r.top < 0.9 && r.maxX - r.minX > 1.5);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('새 소품이 공원 산책로와 입구를 막지 않는다', () => {
    expect(pathClear(map.collision, 4, 0, 20, 0, 0.2)).toBe(true); // 동서 산책로
    expect(pathClear(map.collision, 13.5, -9.3, 13.5, 10.5, 0.2)).toBe(true); // 남북 산책로 (남쪽 끝은 원래 화단)
    expect(isFree(map.collision, map.spawn.x, map.spawn.z, 0.2)).toBe(true);
  });
});

describe('벤치 등받이 (사용자 보고 2026-11-11: 등받이를 뚫고 지나간다)', () => {
  const dt = 1 / 60;
  /** 벤치 하나만 있는 세계 */
  function benchWorld(rotY: number) {
    const k = new MapKit(createRng(1));
    bench(k, 0, 0, rotY);
    return { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, rects: k.rects, circles: k.circles };
  }

  it('앉는 판 위에서 등받이 쪽(−z)으로 걸어도 등받이를 지나가지 못한다', () => {
    const world = benchWorld(0);
    const c = new CatController(world, 0.4);
    c.placeIn(world, 0, 0.12, Math.PI);
    c.y = c.bodyY = 0.47; // 앉는 판 위에 올라섰다
    for (let i = 0; i < 180; i++) c.moveDirect(0, -1, dt);
    expect(c.y).toBeCloseTo(0.47); // 판에서 떨어지지 않았다
    expect(c.z).toBeGreaterThan(-0.05); // 등받이 앞에서 멈춘다
  });

  it('돌려 놓은 벤치(90°)도 등받이가 막는다', () => {
    const world = benchWorld(Math.PI / 2);
    const c = new CatController(world, 0.4);
    c.placeIn(world, 0.12, 0, -Math.PI / 2);
    c.y = c.bodyY = 0.47;
    for (let i = 0; i < 180; i++) c.moveDirect(-1, 0, dt);
    expect(c.x).toBeGreaterThan(-0.05);
  });

  it('앉는 판 앞쪽에는 여전히 올라설 수 있다', () => {
    const world = benchWorld(0);
    expect(world.rects.some((r) => r.top !== undefined && Math.abs(r.top - 0.47) < 0.01 && r.maxZ > 0.15)).toBe(true);
  });
});
