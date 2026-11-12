import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isFree, pathClear } from '../src/world/collision';
import { MAPS, mapById } from '../src/world/maps';
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

describe('들판 맵 (D-58 4단계: 탁 트인 풀밭 + 연못, 평평한 땅)', () => {
  const def = mapById('meadow');
  const plain = def.build({});
  const map = def.build(fakeModels());

  it('맵 목록에 들판이 있고 지도 메뉴용 이름·소개가 있다', () => {
    expect(MAPS.map((m) => m.id)).toContain('meadow');
    expect(def.id).toBe('meadow');
    expect(def.name).toBe('들판');
    expect(def.blurb.length).toBeGreaterThan(0);
  });

  it('연못·꽃밭·풀밭·햇볕 자리 관심 지점이 있다 (자동 생활이 갈 곳)', () => {
    const kinds = map.interests.map((i) => i.kind);
    expect(kinds).toContain('pond');
    expect(kinds.filter((k) => k === 'flower').length).toBeGreaterThanOrEqual(3);
    expect(kinds.filter((k) => k === 'grass').length).toBeGreaterThanOrEqual(8);
    expect(kinds.filter((k) => k === 'sunspot').length).toBeGreaterThanOrEqual(3);
  });

  it('고른 소품 모델이 놓이고, 꽃·풀은 종류마다 한 번에 그린다 (InstancedMesh)', () => {
    const placed = new Set<string>();
    const scattered = new Map<string, number>();
    map.group.traverse((o) => {
      if (!o.userData.prop) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) scattered.set(o.userData.prop, (o as THREE.InstancedMesh).count);
      else placed.add(o.userData.prop);
    });
    for (const id of ['tallPine', 'youngPine', 'roundTree', 'stump', 'boulder', 'fenceGate', 'stile', 'signpost', 'slabStone', 'dirtTrail', 'picnicTable', 'buddleia', 'cowParsley']) {
      expect(placed, id).toContain(id);
    }
    for (const id of ['daisy', 'dandelion', 'grassTuft', 'clover', 'cattail', 'lilyPad', 'fence']) expect(scattered.get(id) ?? 0, id).toBeGreaterThan(3);
  });

  it('들풀은 화분 흙덩이가 붙은 모델 대신 공원 풀 포기를 쓴다 (사용자 선택 2026-11-12)', () => {
    expect(Object.keys(PROP_SPECS)).not.toContain('meadowGrass');
  });

  it('꽃밭마다 코드로 만든 작은 꽃송이를 촘촘히 깐다 (한 번에 그림, 모델이 없어도 있음)', () => {
    for (const m of [map, plain]) {
      let dots: THREE.InstancedMesh | undefined;
      m.group.traverse((o) => {
        if (o.name === 'flowerDots') dots = o as THREE.InstancedMesh;
      });
      expect(dots?.isInstancedMesh).toBe(true);
      expect(dots!.count).toBeGreaterThanOrEqual(300);
      expect(dots!.instanceColor).toBeTruthy(); // 송이마다 색이 다르다
    }
  });

  it('피크닉 테이블·큰 바위·그루터기는 올라설 수 있다', () => {
    const tops = map.collision.rects.filter((r) => r.top !== undefined).map((r) => r.top!);
    expect(tops.some((t) => t > 0.6 && t < 0.85)).toBe(true); // 피크닉 테이블 윗면
    expect(tops.filter((t) => t > 0.3 && t < 0.7).length).toBeGreaterThanOrEqual(2); // 바위·그루터기
  });

  it('출발점에서 먹이 쉼터 앞, 연못가까지 막히지 않고 걸어갈 수 있다', () => {
    const { spawn, foodStation } = map;
    const pond = map.interests.find((i) => i.kind === 'pond')!;
    expect(isFree(map.collision, spawn.x, spawn.z, 0.2)).toBe(true);
    expect(pathClear(map.collision, spawn.x, spawn.z, foodStation.x, foodStation.z - 0.6, 0.2)).toBe(true);
    // 연못 서쪽 물가 (연못 원 바깥 0.5m)
    expect(pathClear(map.collision, spawn.x, spawn.z, pond.x - pond.r - 0.3, pond.z, 0.2)).toBe(true);
  });

  it('둘레는 막혀 있다 (맵 밖으로 나가지 못한다)', () => {
    const b = map.collision.bounds;
    expect(isFree(map.collision, b.maxX + 1, 0, 0.2)).toBe(false);
    expect(isFree(map.collision, 0, b.minZ - 1, 0.2)).toBe(false);
  });

  it('충돌은 모델이 있든 없든 같다 (모델을 못 불러와도 같은 맵)', () => {
    const key = (m: typeof map) => [
      ...m.collision.rects.map((r) => `${r.minX.toFixed(2)},${r.maxX.toFixed(2)},${r.minZ.toFixed(2)},${r.maxZ.toFixed(2)},${r.top?.toFixed(2) ?? '-'}`),
      ...m.collision.circles.map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)},${c.r.toFixed(2)}`),
    ].sort();
    expect(key(map)).toEqual(key(plain));
  });
});
