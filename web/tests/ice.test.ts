import { describe, expect, it } from 'vitest';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { CatController } from '../src/cat/CatController';
import { LIE_POSES } from '../src/cat/liePoses';
import type { CollisionWorld } from '../src/world/collision';

const dt = 1 / 60;
const flat: CollisionWorld = { bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, rects: [], circles: [] };

/** 북쪽(+z)으로 2초 걷다가 멈춘 뒤, 멈춘 자리에서 더 간 거리 */
function stopDistance(slippery: boolean): number {
  const c = new CatController(flat, 0.4);
  c.slippery = slippery;
  for (let i = 0; i < 120; i++) c.moveDirect(0, 1, dt);
  const z0 = c.z;
  for (let i = 0; i < 300; i++) c.moveDirect(0, 0, dt);
  return c.z - z0;
}

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0.5, elapsed: 5, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

describe('얼음 위 미끄덩 (보드 X-05, 5단계 ④)', () => {
  it('얼음 밖에서는 멈추면 바로 선다 (지금과 같음)', () => {
    expect(stopDistance(false)).toBeLessThan(0.12);
  });

  it('얼음 위에서는 멈춰도 0.4m쯤 더 미끄러지다 선다', () => {
    const d = stopDistance(true);
    expect(d).toBeGreaterThan(0.25);
    expect(d).toBeLessThan(0.6);
  });

  it('얼음 밖 움직임은 미끄럼 기능이 생기기 전과 똑같다 (같은 입력 → 같은 자리)', () => {
    const a = new CatController(flat, 0.4);
    const b = new CatController(flat, 0.4);
    b.slippery = true;
    b.slippery = false; // 켰다 꺼도 남는 것이 없다
    const path: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0], [-1, 0.3]];
    for (const [x, z] of path) for (let i = 0; i < 40; i++) {
      a.moveDirect(x, z, dt);
      b.moveDirect(x, z, dt);
    }
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
  });

  it('얼음 위에서 방향을 크게 바꾸면 한동안 원래 방향으로 밀려간다', () => {
    const run = (slippery: boolean) => {
      const c = new CatController(flat, 0.4);
      c.slippery = slippery;
      for (let i = 0; i < 120; i++) c.moveDirect(0, 1, dt);
      const z0 = c.z;
      for (let i = 0; i < 40; i++) c.moveDirect(1, 0, dt); // 동쪽으로 돌기
      return c.z - z0;
    };
    expect(run(true)).toBeGreaterThan(run(false) + 0.08);
  });

  it('미끄러지는 동안만 sliding: 얼음 위에서 멈춘 직후 켜지고, 다 선 뒤와 얼음 밖에서는 꺼진다', () => {
    const c = new CatController(flat, 0.4);
    c.slippery = true;
    for (let i = 0; i < 120; i++) c.moveDirect(0, 1, dt);
    for (let i = 0; i < 6; i++) c.moveDirect(0, 0, dt);
    expect(c.sliding).toBe(true);
    for (let i = 0; i < 300; i++) c.moveDirect(0, 0, dt);
    expect(c.sliding).toBe(false);
    const d = new CatController(flat, 0.4);
    for (let i = 0; i < 120; i++) d.moveDirect(0, 1, dt);
    for (let i = 0; i < 6; i++) d.moveDirect(0, 0, dt);
    expect(d.sliding).toBe(false);
  });

  it('얼음 위에서 걷기 시작할 때는 버티지 않는다 (더디게 속도가 붙을 뿐, 미끄러지는 것은 멈추거나 돌 때)', () => {
    const c = new CatController(flat, 0.4);
    c.slippery = true;
    for (const step of [dt, 0.1]) {
      // 느린 기기(한 프레임 0.1초)에서도: 한 프레임 안에서 가려는 속도가 실제 속도를 크게 앞질러도 미끄럼이 아니다
      const c2 = new CatController(flat, 0.4);
      c2.slippery = true;
      for (let i = 0; i < 90; i++) {
        c2.moveDirect(0, 1, step);
        expect(c2.sliding, `step ${step} frame ${i}`).toBe(false);
      }
    }
    expect(c.sliding).toBe(false);
  });

  it('자동 생활: 얼음 위에서는 목표 앞에서 미리 늦추지 않아, 닿은 뒤 0.15m 넘게 미끄러진다 (얼음 밖은 거의 그 자리)', () => {
    const over = (slippery: boolean) => {
      const c = new CatController(flat, 0.4);
      c.slippery = slippery;
      let arrived = false;
      for (let i = 0; i < 900 && !arrived; i++) arrived = c.walkTo(0, 3, dt);
      const z0 = c.z;
      for (let i = 0; i < 300; i++) c.walkTo(0, 3, dt);
      return c.z - z0;
    };
    expect(over(false)).toBeLessThan(0.05);
    expect(over(true)).toBeGreaterThan(0.15);
  });

  it('미끄러지는 동안에는 걸음 위상이 거의 나아가지 않는다 (발을 벌리고 버틴 채 밀려감)', () => {
    const c = new CatController(flat, 0.4);
    c.slippery = true;
    for (let i = 0; i < 120; i++) c.moveDirect(0, 1, dt);
    for (let i = 0; i < 4; i++) c.moveDirect(0, 0, dt);
    const g0 = c.gaitPhase;
    const z0 = c.z;
    for (let i = 0; i < 20; i++) c.moveDirect(0, 0, dt);
    expect(c.z - z0).toBeGreaterThan(0.05);
    expect(Math.abs(c.gaitPhase - g0)).toBeLessThan(0.05);
  });

  it('Blender 자세 iceBrace: 자세 목록에 있고, 미끄러지는 동안 빠르게 1로 (걷는 중에도)', () => {
    expect(LIE_POSES).toContain('iceBrace');
    const a = new CatAnimator();
    for (let i = 0; i < 15; i++) a.update(input({ behavior: 'walk', speed: 0.4, iceBrace: true, standingUp: true }), dt);
    expect(a.pose.iceBrace).toBeGreaterThan(0.8);
    for (let i = 0; i < 120; i++) a.update(input({ iceBrace: false }), dt);
    expect(a.pose.iceBrace).toBeLessThan(0.05);
  });
});
