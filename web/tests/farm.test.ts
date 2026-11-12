import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { groundAt, isFree, pathClear } from '../src/world/collision';
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

describe('농장 맵 (D-58 5단계: 마당 + 둘레 밭, 낮은 것만 올라서기)', () => {
  const def = mapById('farm');
  const plain = def.build({});
  const map = def.build(fakeModels());

  it('맵 목록에 농장이 있고 지도 메뉴용 이름·소개가 있다', () => {
    expect(MAPS.map((m) => m.id)).toContain('farm');
    expect(def.id).toBe('farm');
    expect(def.name).toBe('농장');
    expect(def.blurb.length).toBeGreaterThan(0);
  });

  it('고른 모델이 놓이고, 밭 작물·울타리는 종류마다 한 번에 그린다 (InstancedMesh)', () => {
    const placed = new Set<string>();
    const scattered = new Map<string, number>();
    map.group.traverse((o) => {
      if (!o.userData.prop) return;
      if ((o as THREE.InstancedMesh).isInstancedMesh) scattered.set(o.userData.prop, (o as THREE.InstancedMesh).count);
      else placed.add(o.userData.prop);
    });
    for (const id of ['redBarn', 'farmhouse', 'chickenCoop', 'toolShed', 'grainSilo', 'windpump', 'appleTree', 'plumTree', 'hayBale', 'scarecrow', 'wheelbarrow', 'waterTrough', 'stoneWell', 'farmGate', 'feedSack', 'beehive', 'tractor', 'tilledSoil']) {
      expect(placed, id).toContain(id);
    }
    for (const id of ['wheatCrop', 'cornCrop', 'pumpkinCrop', 'sunflower', 'strawberryCrop', 'tomatoCrop', 'berryBush', 'farmFence']) {
      expect(scattered.get(id) ?? 0, id).toBeGreaterThan(3);
    }
  });

  it('건물은 막혀 있고 올라설 수 없다 (높은 지붕)', () => {
    const tall = map.collision.rects.filter((r) => r.maxX - r.minX > 5 && r.maxZ - r.minZ > 4);
    expect(tall.length).toBeGreaterThanOrEqual(2); // 헛간·농가
    for (const r of tall) expect(r.top).toBeUndefined();
  });

  it('건초 더미는 두 층으로 쌓여 계단처럼 오른다 (0.6m → 1.2m)', () => {
    const bales = map.collision.rects.filter((r) => r.top !== undefined && Math.abs(r.top - 0.6) < 0.05);
    const upper = map.collision.rects.filter((r) => r.top !== undefined && Math.abs(r.top - 1.2) < 0.05);
    expect(bales.length).toBeGreaterThanOrEqual(2);
    expect(upper.length).toBeGreaterThanOrEqual(1);
    const u = upper[0];
    const cx = (u.minX + u.maxX) / 2;
    const cz = (u.minZ + u.maxZ) / 2;
    // 위 단은 아래 단 위에 놓여 있다: 아래 단(0.59m)에 점프로 올라선 뒤 다시 점프로 위 단(1.18m)에 오른다 (높이 차 0.59m씩)
    const lower = bales.find((r) => r.minX <= u.minX && r.maxX >= u.maxX && r.minZ <= u.minZ && r.maxZ >= u.maxZ);
    expect(lower).toBeTruthy();
    expect(groundAt(map.collision, cx, cz, 0)).toBe(0); // 바닥에서 걸어서는 못 오른다 (점프)
    expect(groundAt(map.collision, cx, cz, 0.59)).toBeCloseTo(0.59, 2);
    expect(groundAt(map.collision, cx, cz, 1.18)).toBeCloseTo(1.18, 2);
  });

  it('관심 지점: 해바라기·열매 덤불(꽃), 과수원(풀), 물통(물), 트랙터(차), 햇볕 자리', () => {
    const kinds = map.interests.map((i) => i.kind);
    for (const k of ['flower', 'grass', 'pond', 'car', 'sunspot'] as const) expect(kinds, k).toContain(k);
  });

  it('출발점에서 먹이 쉼터 앞, 밭(문을 지나), 과수원까지 걸어갈 수 있다', () => {
    const { spawn, foodStation } = map;
    expect(isFree(map.collision, spawn.x, spawn.z, 0.2)).toBe(true);
    expect(pathClear(map.collision, spawn.x, spawn.z, foodStation.x, foodStation.z - 0.6, 0.2)).toBe(true);
    const field = map.interests.find((i) => i.kind === 'flower' && i.z < -8)!; // 남쪽 밭의 해바라기 줄
    expect(field).toBeTruthy();
    // 마당 → 남쪽 문 → 밭 (문 자리는 열려 있다)
    expect(pathClear(map.collision, spawn.x, spawn.z, 0, -9.5, 0.2)).toBe(true);
    expect(pathClear(map.collision, 0, -9.5, field.x, field.z + field.r, 0.2)).toBe(true);
    // 마당 가운데를 거쳐 동쪽 과수원으로 (곧장 가면 트랙터를 돌아가야 한다)
    expect(pathClear(map.collision, spawn.x, spawn.z, 3, 0, 0.2)).toBe(true);
    expect(pathClear(map.collision, 3, 0, 15, 0, 0.2)).toBe(true);
  });

  it('충돌은 모델이 있든 없든 같다 (모델을 못 불러와도 같은 맵)', () => {
    const key = (m: typeof map) =>
      [
        ...m.collision.rects.map((r) => `${r.minX.toFixed(2)},${r.maxX.toFixed(2)},${r.minZ.toFixed(2)},${r.maxZ.toFixed(2)},${r.top?.toFixed(2) ?? '-'}`),
        ...m.collision.circles.map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)},${c.r.toFixed(2)}`),
      ].sort();
    expect(key(map)).toEqual(key(plain));
  });
});
