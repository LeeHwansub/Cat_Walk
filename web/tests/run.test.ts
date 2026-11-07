import { describe, expect, it } from 'vitest';
import { CatController, RUN_SPEED, runWeight, WALK_SPEED } from '../src/cat/CatController';
import type { CollisionWorld } from '../src/world/collision';

const open: CollisionWorld = { bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, rects: [], circles: [] };

describe('달리기 (사용자 요청 2026-11-07)', () => {
  it('달리기 속도는 걷기보다 충분히 빠르다', () => {
    expect(RUN_SPEED).toBeGreaterThan(WALK_SPEED * 2);
  });

  it('걷기 속도 이하에서는 달리기 동작 0, 달리기 속도에서는 1, 그 사이는 점점 커진다', () => {
    expect(runWeight(0)).toBe(0);
    expect(runWeight(WALK_SPEED)).toBe(0);
    expect(runWeight(0.62)).toBe(0); // 직접 조작 걷기 속도에서도 걷기 동작만
    expect(runWeight(RUN_SPEED)).toBe(1);
    expect(runWeight(RUN_SPEED * 2)).toBe(1);
    const mid = runWeight((WALK_SPEED + RUN_SPEED) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('작은 고양이는 같은 상대 속도면 같은 비율로 달린다 (크기 배율로 나눈 속도 기준)', () => {
    expect(runWeight(RUN_SPEED * 0.6, 0.6)).toBe(1);
    expect(runWeight(WALK_SPEED * 0.6, 0.6)).toBe(0);
  });

  it('직접 조작에서 달리기를 켜면 더 빨리 움직인다', () => {
    const walk = new CatController(open, 0.3);
    const run = new CatController(open, 0.3);
    run.running = true;
    for (let i = 0; i < 120; i++) {
      walk.moveDirect(0, 1, 1 / 60);
      run.moveDirect(0, 1, 1 / 60);
    }
    expect(run.speed).toBeGreaterThan(walk.speed * 1.6);
    expect(run.z).toBeGreaterThan(walk.z);
  });

  it('목표로 달려갈 수 있다 (자율: 배고플 때 그릇으로)', () => {
    const c = new CatController(open, 0.3);
    for (let i = 0; i < 120; i++) c.walkTo(0, 50, 1 / 60, 0.25, RUN_SPEED);
    expect(c.speed).toBeGreaterThan(WALK_SPEED * 1.5);
  });
});
