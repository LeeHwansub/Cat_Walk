import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';
import { SNOW_STEP } from '../src/audio/rain';
import { FOOTPRINT_FADE, FOOTPRINT_LIFE, FOOTPRINT_MAX, Footprints, stepsCrossed } from '../src/world/footprints';
import { mapById } from '../src/world/maps';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

describe('눈 위 발자국 (보드 X-05, 5단계 ②)', () => {
  const xmas = mapById('xmas').build({});

  it('눈 오는 광장 바닥: 광장·길은 돌, 연못은 얼음, 나머지는 눈', () => {
    expect(xmas.surfaceAt!(0, -2)).toBe('stone'); // 광장
    expect(xmas.surfaceAt!(0, -11)).toBe('stone'); // 남쪽 입구 길
    expect(xmas.surfaceAt!(10, 8.7)).toBe('stone'); // 마켓 거리
    expect(xmas.surfaceAt!(7.2, -0.8)).toBe('stone'); // 화로 가는 길
    expect(xmas.surfaceAt!(-13, -3)).toBe('ice');
    expect(xmas.surfaceAt!(5, -10)).toBe('snow');
    expect(xmas.surfaceAt!(-10, 3)).toBe('snow');
  });

  it('다른 맵에는 바닥 종류가 없다 (발자국이 남지 않는다)', () => {
    for (const id of ['neighborhood', 'meadow', 'farm']) expect(mapById(id).build({}).surfaceAt).toBeUndefined();
  });

  it('걸음: 걸음 위상이 0과 0.5를 지날 때 한 발씩 (왼발·오른발 번갈아)', () => {
    expect(stepsCrossed(0.9, 0.1)).toEqual(['L']);
    expect(stepsCrossed(0.4, 0.6)).toEqual(['R']);
    expect(stepsCrossed(0.1, 0.3)).toEqual([]);
    expect(stepsCrossed(0.45, 0.05)).toEqual(['R', 'L']); // 한 프레임에 두 번 지나도
  });

  it('발자국 판 60개를 돌려 쓴다: 61번째는 가장 오래된 자리를 쓴다 (그리기 1회)', () => {
    const f = new Footprints();
    expect(f.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(f.mesh.count).toBe(FOOTPRINT_MAX);
    expect(FOOTPRINT_MAX).toBe(60);
    for (let i = 0; i <= 60; i++) f.add(i * 0.3, 0, 0, i % 2 ? 'R' : 'L', i * 0.1);
    expect(f.active).toBe(60);
    const m = new THREE.Matrix4();
    f.mesh.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBeCloseTo(60 * 0.3, 1); // 0번 자리를 다시 씀
  });

  it('발자국은 걷는 방향을 따라 왼쪽·오른쪽으로 조금 비켜 찍힌다', () => {
    const f = new Footprints();
    f.add(0, 0, 0, 'L', 0); // 북쪽(+z)을 보면 왼쪽은 +x
    f.add(0, 0, 0, 'R', 0);
    const p = (i: number) => {
      const m = new THREE.Matrix4();
      f.mesh.getMatrixAt(i, m);
      return new THREE.Vector3().setFromMatrixPosition(m);
    };
    expect(p(0).x).toBeGreaterThan(0.02);
    expect(p(1).x).toBeLessThan(-0.02);
  });

  it('발가락(그림 위쪽)이 걷는 방향(앞)을 향한다', () => {
    const f = new Footprints();
    const pos = f.mesh.geometry.getAttribute('position');
    const uv = f.mesh.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) if (uv.getY(i) > 0.5) expect(pos.getZ(i)).toBeGreaterThan(0); // 앞 = +z
  });

  it('20초 지나면 서서히 눈 색이 되어 사라지고, 다 사라지면 자리가 빈다', () => {
    const f = new Footprints();
    f.add(1, 1, 0, 'L', 0);
    const color = () => {
      const c = new THREE.Color();
      f.mesh.getColorAt(0, c);
      return c.getHex();
    };
    f.update(1);
    const fresh = color();
    f.update(FOOTPRINT_LIFE + FOOTPRINT_FADE / 2);
    const fading = color();
    expect(fading).not.toBe(fresh);
    f.update(FOOTPRINT_LIFE + FOOTPRINT_FADE + 0.1);
    expect(f.active).toBe(0);
    expect(FOOTPRINT_LIFE).toBe(20);
  });

  it('맵을 바꾸면 발자국을 모두 지운다', () => {
    const f = new Footprints();
    f.add(1, 1, 0, 'L', 0);
    f.clear();
    expect(f.active).toBe(0);
  });

  it('눈 밟는 소리: 짧고 작게, 소리를 켜기 전에는 아무 일도 없다', () => {
    expect(SNOW_STEP.length).toBeLessThan(0.15);
    expect(SNOW_STEP.gain).toBeLessThan(0.08);
    expect(() => new AudioManager().snowStep()).not.toThrow();
  });
});
