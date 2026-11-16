import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { groundAt, isFree, pathClear, type CollisionWorld } from '../src/world/collision';
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

/** 경유점을 차례로 이어 걸어갈 수 있는가 */
const walk = (w: CollisionWorld, pts: [number, number][]) => pts.every((p, i) => i === 0 || pathClear(w, pts[i - 1][0], pts[i - 1][1], p[0], p[1], 0.2));

describe('크리스마스 맵 "눈 오는 광장" (보드 X-03 평면도대로, 2026-11-16)', () => {
  const def = mapById('xmas');
  const plain = def.build({});
  const map = def.build(fakeModels());
  const tall = (minW: number, minD: number) => map.collision.rects.filter((r) => r.top === undefined && r.maxX - r.minX >= minW && r.maxZ - r.minZ >= minD);

  it('맵 목록에 있고 지도 메뉴용 이름·소개가 있다', () => {
    expect(MAPS.map((m) => m.id)).toContain('xmas');
    expect(def.name).toBe('눈 오는 광장');
  });

  it('소품 20종 (직접 만든 18 + 눈 얹은 소나무·벤치), 그루터기 의자', () => {
    const ids = new Set<string>();
    map.group.traverse((o) => o.userData.prop && ids.add(o.userData.prop));
    for (const id of ['xmasTreeLarge', 'xmasTreeSmall', 'giftS', 'giftM', 'giftL', 'giftOpen', 'marketStall', 'ribbonLamp', 'logCabin', 'firewoodStack', 'firePit', 'snowman', 'sled', 'snowPile', 'woodenReindeer', 'candyCane', 'santaMailbox', 'yarnBall', 'tallPine', 'parkBench', 'stump']) {
      expect(ids, id).toContain(id);
    }
  });

  it('출발은 (0, −10)에서 북쪽(트리)을 본다', () => {
    expect(map.spawn).toEqual({ x: 0, z: -10, heading: 0 });
  });

  it('큰 트리는 줄기만 막혀 가지 밑으로 지나간다', () => {
    expect(isFree(map.collision, 0, 0, 0.2)).toBe(false);
    expect(isFree(map.collision, 0, 1.1, 0.2)).toBe(true);
    expect(isFree(map.collision, 1.1, 0, 0.2)).toBe(true);
  });

  it('선물 상자 계단: 소 0.3 → 중 0.5 → 대 0.8m, 차례로 뛰어오른다', () => {
    const at = (x: number, z: number, y: number) => groundAt(map.collision, x, z, y);
    expect(at(-1.2, -2.8, 0.2)).toBeCloseTo(0.3, 1);
    expect(at(-1.85, -2.35, 0.5)).toBeCloseTo(0.5, 1);
    expect(at(-2.5, -1.9, 0.8)).toBeCloseTo(0.8, 1);
  });

  it('북쪽 가판대 5개(진열대 0.86m에 올라섬), 서쪽 오두막 2채', () => {
    const counters = map.collision.rects.filter((r) => r.top !== undefined && Math.abs(r.top - 0.86) < 0.01 && r.minZ > 9);
    expect(counters).toHaveLength(5);
    const cabins = tall(4, 5).filter((r) => r.minX > 12); // 콘셉트 그림처럼 입구에서 볼 때 왼쪽 (이 좌표에서는 +x)
    expect(cabins).toHaveLength(2);
  });

  it('얼음 연못(−13, −3) 위를 걸을 수 있다', () => {
    expect(isFree(map.collision, -13, -3, 0.2)).toBe(true);
    expect(isFree(map.collision, -15.5, -3, 0.2)).toBe(true);
  });

  it('화로는 가운데만 막히고 둘레에 그루터기 의자 3개(0.36m), 장작 더미 0.65m', () => {
    expect(isFree(map.collision, 9.3, -0.8, 0.2)).toBe(false);
    const stumps = map.collision.rects.filter((r) => r.top !== undefined && Math.abs(r.top - 0.36) < 0.01);
    expect(stumps).toHaveLength(3);
    expect(map.collision.rects.some((r) => r.top !== undefined && Math.abs(r.top - 0.65) < 0.01)).toBe(true);
  });

  it('출발점에서 먹이 쉼터 앞, 화로 곁, 얼음 연못, 썰매 곁까지 걸어간다', () => {
    const s: [number, number] = [map.spawn.x, map.spawn.z];
    const f: [number, number] = [map.foodStation.x, map.foodStation.z - 0.6];
    expect(map.foodStation).toEqual({ x: -4.2, z: 9.3 });
    expect(walk(map.collision, [s, [0, -5.5], [4, -4], [4.5, 4], [-1.5, 6.5], f])).toBe(true);
    expect(walk(map.collision, [s, [0, -5.5], [4, -4], [7.2, -0.8]])).toBe(true);
    expect(walk(map.collision, [s, [0, -5.5], [-5, -3.5], [-13, -3]])).toBe(true);
    expect(walk(map.collision, [s, [0, -9], [-6, -9], [-9.6, -9.6]])).toBe(true); // 길가 화분 트리 사이로
  });

  it('불빛 자리: 첫째는 화로(주황), 가로등·오두막 창문 포함 10곳 이상', () => {
    expect(map.lights!.length).toBeGreaterThanOrEqual(10);
    expect(map.lights![0]).toMatchObject({ x: 9.3, z: -0.8 });
  });

  it('눈 내리기는 날씨가 맡는다: 맵에는 눈 입자가 없고 기본 날씨가 눈 (날씨 아이콘, 2026-11-16)', () => {
    let snow = 0;
    map.group.traverse((o) => {
      if ((o as THREE.Points).isPoints && o.name === 'snowfall') snow++;
    });
    expect(snow).toBe(0);
    expect(def.defaultWeather).toBe('snow');
  });

  it('눈 얹기: 소나무·벤치는 이 맵에서만 눈 재질을 쓰고 원본 모델 재질은 그대로', () => {
    const models = fakeModels();
    const original = models.tallPine as THREE.Mesh;
    const m = def.build(models);
    let snowy = 0;
    m.group.traverse((o) => {
      if (o.userData.prop === 'tallPine' && (o as THREE.Mesh).material !== original.material) snowy++;
    });
    expect(snowy).toBeGreaterThan(0);
    expect((original.material as THREE.Material).userData.snowy).toBeUndefined();
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
