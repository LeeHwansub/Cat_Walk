import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import type { CollisionWorld } from '../src/world/collision';

const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const dt = 1 / 60;

/** 계단 세 칸(0.17씩, x 방향) · 담(윗면 1.36, x 방향으로 긴 0.26 폭) · 건물(윗면 없음) */
const world: CollisionWorld = {
  bounds,
  rects: [
    { minX: 1, maxX: 1.3, minZ: -1, maxZ: 1, top: 0.17 },
    { minX: 1.3, maxX: 1.6, minZ: -1, maxZ: 1, top: 0.34 },
    { minX: 1.6, maxX: 4, minZ: -1, maxZ: 1, top: 0.51 },
    { minX: -5, maxX: 5, minZ: 4.87, maxZ: 5.13, top: 1.36 },
    { minX: -5, maxX: 5, minZ: 5.13, maxZ: 9 },
  ],
  circles: [],
};

function run(c: CatController, steps: number, dirX: number, dirZ: number) {
  for (let i = 0; i < steps; i++) c.moveDirect(dirX, dirZ, dt);
}

describe('고양이 세로 움직임 (J-1)', () => {
  it('평지에서는 높이가 생기기 전과 같다 (y = 0 그대로, 같은 위치)', () => {
    const flat: CollisionWorld = { bounds, rects: [], circles: [] };
    const c = new CatController(flat, 0.4);
    run(c, 120, 0, 1);
    expect(c.y).toBe(0);
    expect(c.x).toBeCloseTo(0);
    // 0.62 m/s까지 1.6 m/s²로 가속: 2초 동안 약 1.12m
    expect(c.z).toBeGreaterThan(1.0);
    expect(c.z).toBeLessThan(1.25);
  });

  it('계단을 걸어서 오르고(높이가 칸 윗면을 따라감), 다시 걸어 내려온다', () => {
    const c = new CatController(world, 0.4);
    c.heading = Math.PI / 2; // +x
    run(c, 400, 1, 0);
    expect(c.x).toBeGreaterThan(2);
    expect(c.y).toBeCloseTo(0.51, 2);
    run(c, 600, -1, 0);
    expect(c.x).toBeLessThan(0.5);
    expect(c.y).toBeCloseTo(0, 2);
  });

  it('턱보다 높은 담은 바닥에서 막는다', () => {
    const c = new CatController(world, 0.4);
    run(c, 300, 0, 1);
    expect(c.z).toBeLessThan(4.87);
    expect(c.y).toBe(0);
  });

  it('담 위에서는 가장자리에서 멈추고 떨어지지 않는다 (계속 밀어 뛰어내리기 전까지, J-3)', () => {
    const c = new CatController(world, 0.4);
    c.x = 0;
    c.z = 5;
    c.y = 1.36;
    for (let i = 0; i < 200 && !c.jumping; i++) {
      c.moveDirect(0, -1, dt); // 길 쪽으로 밀기
      if (c.jumping) break;
      expect(c.y).toBeCloseTo(1.36);
      expect(c.z).toBeGreaterThanOrEqual(4.87);
    }
  });

  it('담 위에서 비스듬히 밀면 담을 따라 미끄러지며 걷는다', () => {
    const c = new CatController(world, 0.4);
    c.x = 0;
    c.z = 5;
    c.y = 1.36;
    c.heading = Math.PI / 2;
    run(c, 120, 1, -0.4);
    expect(c.x).toBeGreaterThan(0.5);
    expect(c.y).toBeCloseTo(1.36);
  });

  it('담 끝에서도 멈춘다 (뛰어내리기 전까지)', () => {
    const c = new CatController(world, 0.4);
    c.x = 4.5;
    c.z = 5;
    c.y = 1.36;
    c.heading = Math.PI / 2;
    for (let i = 0; i < 300 && !c.jumping; i++) {
      c.moveDirect(1, 0, dt);
      if (c.jumping) break;
      expect(c.x).toBeLessThanOrEqual(5);
      expect(c.y).toBeCloseTo(1.36);
    }
  });

  it('발밑이 비면 중력으로 떨어져 바닥에 선다', () => {
    const c = new CatController(world, 0.4);
    c.x = -8;
    c.y = 1.2;
    for (let i = 0; i < 60; i++) c.updateVertical(dt);
    expect(c.y).toBe(0);
    expect(c.vy).toBe(0);
  });
});
