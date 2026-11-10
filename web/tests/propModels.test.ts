import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { MapKit } from '../src/world/parts/kit';
import { car } from '../src/world/parts/props';
import { bakeModel, PROP_SPECS, recolorBody, topAt } from '../src/world/propModels';
import { buildNeighborhood } from '../src/world/map/neighborhood';
import { isFree } from '../src/world/collision';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

/** 정점 색이 있는 상자 (Polyfork 모델처럼 COLOR_0로 칠한 메시) */
function coloredBox(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.5), 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true }));
  m.position.set(x, y, z);
  return m;
}

describe('소품 모델 굽기 (Polyfork glb, 2026-11-09 시범)', () => {
  it('여러 메시를 정점 색을 유지한 메시 하나로 굽고, 바닥 0·축척을 맞춘다', () => {
    const src = new THREE.Group();
    src.add(coloredBox(1, 1, 2, 5, 3, 0), coloredBox(1, 0.5, 1, 5, 2.25, 1.5));
    const baked = bakeModel(src, 2);
    let meshes = 0;
    baked.traverse((o) => (meshes += (o as THREE.Mesh).isMesh ? 1 : 0));
    expect(meshes).toBe(1);
    const mesh = baked as THREE.Mesh;
    expect(mesh.geometry.getAttribute('color')).toBeDefined(); // 색이 지워지지 않는다
    const b = new THREE.Box3().setFromObject(baked);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.z - b.min.z).toBeCloseTo(3 * 2); // 원래 z 길이 3 × 축척 2
  });

  it('바닥에 닿는 부분(기둥)의 가운데를 원점에 둔다: 팔이 한쪽으로 뻗은 가로등도 기둥이 충돌 위치에 온다', () => {
    const src = new THREE.Group();
    src.add(coloredBox(0.2, 5, 0.2, 0.9, 2.5, -1), coloredBox(0.2, 0.2, 2, 0.9, 4.9, 0)); // 기둥(z −1) + 앞으로 뻗은 팔
    const baked = bakeModel(src, 1);
    const pos = (baked as THREE.Mesh).geometry.getAttribute('position');
    let x = 0, z = 0, n = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.1) (x += pos.getX(i)), (z += pos.getZ(i)), n++;
    expect(x / n).toBeCloseTo(0);
    expect(z / n).toBeCloseTo(0);
  });

  it('topAt: 그 지점의 윗면 높이 (보닛·지붕 구분용)', () => {
    const src = new THREE.Group();
    src.add(coloredBox(1, 0.8, 4, 0, 0.4, 0), coloredBox(1, 0.6, 1.6, 0, 1.1, 0)); // 몸체 + 지붕
    const baked = bakeModel(src, 1);
    expect(topAt(baked, 0, 1.6)).toBeCloseTo(0.8); // 앞쪽(보닛)
    expect(topAt(baked, 0, 0)).toBeCloseTo(1.4); // 가운데(지붕)
    expect(topAt(baked, 0, 9)).toBe(0); // 바깥
  });

  it('모델 정보: 파일 이름과 축척이 있다', () => {
    for (const s of Object.values(PROP_SPECS)) {
      expect(s.file).toMatch(/\.glb$/);
      expect(s.scale).toBeGreaterThan(0);
    }
  });
});

describe('차 색 바꾸기 (사용자 요청 2026-11-10: 해치백이 모두 같은 노란색)', () => {
  it('가장 많이 쓰인 색(차체)만 바꾸고 나머지(유리·바퀴)는 그대로, 원본은 건드리지 않는다', () => {
    const src = new THREE.Group();
    const body = coloredBox(2, 1, 4, 0, 0.5, 0); // 정점 24개
    const glass = coloredBox(1, 0.4, 1, 0, 1.2, 0);
    const tc = glass.geometry.getAttribute('color');
    for (let i = 0; i < tc.count; i++) tc.setXYZ(i, 0.1, 0.1, 0.1);
    const big = coloredBox(2, 0.2, 4, 0, 0.1, 0); // 차체 색 정점을 더 많게
    src.add(body, glass, big);
    const baked = bakeModel(src, 1);
    const red = recolorBody(baked, '#ff0000');
    const col = red.geometry.getAttribute('color');
    const want = new THREE.Color('#ff0000');
    let changed = 0, kept = 0;
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - want.r) < 1e-4 && Math.abs(col.getY(i) - want.g) < 1e-4) changed++;
      if (Math.abs(col.getX(i) - 0.1) < 1e-4) kept++;
    }
    expect(changed).toBeGreaterThan(0);
    expect(kept).toBe(glass.geometry.index!.count); // 유리 정점은 그대로 (굽기에서 인덱스를 풀어 삼각형 꼭짓점 수)
    expect((baked as THREE.Mesh).geometry.getAttribute('color').getX(0)).toBeCloseTo(0.5); // 원본은 그대로
  });

  it('MapKit.prop(tint): 같은 모델·같은 색은 도형을 함께 쓴다', () => {
    const k = new MapKit(createRng(1));
    const src = new THREE.Group();
    src.add(coloredBox(2, 1, 4, 0, 0.5, 0));
    k.models = { hatchback: bakeModel(src, 1) };
    const fb = { w: 1, h: 1, d: 1, color: '#888888' };
    const a = k.prop('hatchback', 0, 0, 0, fb, '#39465c') as THREE.Mesh;
    const b = k.prop('hatchback', 5, 0, 0, fb, '#39465c') as THREE.Mesh;
    const c = k.prop('hatchback', 9, 0, 0, fb, '#f2f2f2') as THREE.Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(a.geometry).not.toBe(c.geometry);
  });
});

describe('MapKit.prop: 모델이 있으면 모델, 없으면 같은 크기의 상자', () => {
  it('모델이 없으면 상자로 대신 놓고, 구역 합치기에서 뺀다', () => {
    const k = new MapKit(createRng(1));
    const o = k.prop('bin', 1, 2, 0, { w: 0.5, h: 0.8, d: 0.5, color: '#888888' });
    expect(o.userData.prop).toBe('bin');
    expect(o.position.x).toBeCloseTo(1);
    expect(k.unmerged).toContain(o);
  });

  it('모델이 있으면 복제해서 놓는다 (같은 도형을 함께 쓴다)', () => {
    const k = new MapKit(createRng(1));
    const src = new THREE.Group();
    src.add(coloredBox(0.5, 0.8, 0.5, 0, 0.4, 0));
    k.models = { bin: bakeModel(src, 1) };
    const a = k.prop('bin', 1, 2, 0, { w: 0.5, h: 0.8, d: 0.5, color: '#888888' });
    const b = k.prop('bin', 3, 2, 0, { w: 0.5, h: 0.8, d: 0.5, color: '#888888' });
    expect((a as THREE.Mesh).geometry).toBe((b as THREE.Mesh).geometry);
  });

  it('차 모델: 보닛·트렁크는 잰 높이로 올라서고, 높은 앞면(경차 밴)은 올라설 수 없다', () => {
    const k = new MapKit(createRng(1));
    const sedan = new THREE.Group();
    sedan.add(coloredBox(1.8, 0.9, 4.2, 0, 0.45, 0), coloredBox(1.6, 0.6, 2, 0, 1.2, 0));
    const van = new THREE.Group();
    van.add(coloredBox(1.6, 1.9, 3.4, 0, 0.95, 0));
    k.models = { hatchback: bakeModel(sedan, 1), keiVan: bakeModel(van, 1) };
    car(k, 0, 0, '#ffffff', 0, 'hatchback');
    const tops = k.rects.map((r) => r.top);
    expect(tops.filter((t) => t !== undefined).map((t) => +t!.toFixed(2))).toEqual([0.9, 0.9]);
    const k2 = new MapKit(createRng(1));
    k2.models = k.models;
    car(k2, 0, 0, '#ffffff', 0, 'keiVan');
    expect(k2.rects.every((r) => r.top === undefined)).toBe(true);
  });
});

describe('골목 소품 배치 (시범)', () => {
  const map = buildNeighborhood();

  it('새 소품(자판기·자전거·오토바이·가로등·쓰레기통·상자·계량기·고깔)이 놓였다', () => {
    const ids = new Set<string>();
    map.group.traverse((o) => o.userData.prop && ids.add(o.userData.prop));
    for (const id of ['vending', 'bicycle', 'moped', 'lamp', 'bin', 'crate', 'meterBox', 'cone']) expect(ids, id).toContain(id);
  });

  it('새 소품은 출발점·먹이 쉼터·NPC 자리를 막지 않는다', () => {
    expect(isFree(map.collision, map.spawn.x, map.spawn.z, 0.2)).toBe(true);
    expect(isFree(map.collision, map.npcSpot.x, map.npcSpot.z, 0.2)).toBe(true);
    expect(isFree(map.collision, map.foodStation.x, map.foodStation.z - 0.6, 0.2)).toBe(true);
  });
});
