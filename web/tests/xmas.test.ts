import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { isFree, pathClear } from '../src/world/collision';
import { MAPS, mapById } from '../src/world/maps';
import { bakeModel, PROP_SPECS, type PropId, type PropModels } from '../src/world/propModels';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

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

describe('크리스마스 맵 "눈 오는 광장" (2026-11-16)', () => {
  const def = mapById('xmas');
  const plain = def.build({});
  const map = def.build(fakeModels());

  it('맵 목록에 있고 지도 메뉴용 이름·소개가 있다', () => {
    expect(MAPS.map((m) => m.id)).toContain('xmas');
    expect(def.name).toBe('눈 오는 광장');
    expect(def.blurb.length).toBeGreaterThan(0);
  });

  it('직접 만든 크리스마스 소품 18종이 모두 놓인다', () => {
    const ids = new Set<string>();
    map.group.traverse((o) => o.userData.prop && ids.add(o.userData.prop));
    for (const id of ['xmasTreeLarge', 'xmasTreeSmall', 'giftS', 'giftM', 'giftL', 'giftOpen', 'marketStall', 'ribbonLamp', 'logCabin', 'firewoodStack', 'firePit', 'snowman', 'sled', 'snowPile', 'woodenReindeer', 'candyCane', 'santaMailbox', 'yarnBall']) {
      expect(ids, id).toContain(id);
    }
  });

  it('눈이 내린다: 프레임마다 눈송이가 아래로 움직이고, 바닥에 닿으면 위로 돌아간다', () => {
    let snow: THREE.Points | undefined;
    map.group.traverse((o) => {
      if (o.name === 'snowfall') snow = o as THREE.Points;
    });
    expect(snow).toBeTruthy();
    const pos = snow!.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(500);
    const y0 = pos.getY(0);
    map.update!(0.1);
    expect(pos.getY(0)).not.toBe(y0);
    for (let i = 0; i < 400; i++) map.update!(0.1); // 40초: 한 번 이상 바닥에 닿는다
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeGreaterThanOrEqual(0);
  });

  it('선물 상자·장작 더미·썰매·눈 더미에 올라선다', () => {
    const tops = [...map.collision.rects.map((r) => r.top), ...map.collision.circles.map((c) => c.top)].filter((t): t is number => t !== undefined);
    expect(tops.filter((t) => t > 0.25 && t < 0.9).length).toBeGreaterThanOrEqual(6);
  });

  it('관심 지점: 화분 트리(화분), 모닥불 곁(햇볕 자리), 장작 위(쉴 곳)', () => {
    const kinds = map.interests.map((i) => i.kind);
    for (const k of ['pot', 'sunspot', 'bench'] as const) expect(kinds, k).toContain(k);
  });

  it('출발점에서 먹이 쉼터 앞, 큰 트리 앞, 모닥불 곁까지 걸어갈 수 있다', () => {
    const { spawn, foodStation } = map;
    expect(isFree(map.collision, spawn.x, spawn.z, 0.2)).toBe(true);
    expect(pathClear(map.collision, spawn.x, spawn.z, foodStation.x, foodStation.z - 0.6, 0.2)).toBe(true);
    expect(pathClear(map.collision, spawn.x, spawn.z, 0, -3.6, 0.2)).toBe(true);
    const fire = map.interests.find((i) => i.kind === 'sunspot' && i.x < -5)!;
    expect(fire).toBeTruthy();
    expect(pathClear(map.collision, spawn.x, spawn.z, fire.x, fire.z, 0.2)).toBe(true);
  });

  it('충돌은 모델이 있든 없든 같다', () => {
    const key = (m: typeof map) =>
      [
        ...m.collision.rects.map((r) => `${r.minX.toFixed(2)},${r.maxX.toFixed(2)},${r.minZ.toFixed(2)},${r.maxZ.toFixed(2)},${r.top?.toFixed(2) ?? '-'}`),
        ...m.collision.circles.map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)},${c.r.toFixed(2)},${c.top?.toFixed(2) ?? '-'}`),
      ].sort();
    expect(key(map)).toEqual(key(plain));
  });
});
