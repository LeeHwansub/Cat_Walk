import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import type { CollisionWorld } from '../src/world/collision';

const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const dt = 1 / 60;

/** 담(x 방향으로 긴 폭 0.26, 윗면 1.36) 뒤는 건물(올라설 수 없음), 오른쪽(+x)에 넓은 평상(윗면 0.5) */
const world: CollisionWorld = {
  bounds,
  rects: [
    { minX: -5, maxX: 5, minZ: 4.87, maxZ: 5.13, top: 1.36 },
    { minX: -5, maxX: 5, minZ: 5.13, maxZ: 9 },
    { minX: 8, maxX: 10, minZ: -1, maxZ: 1, top: 0.5 },
  ],
  circles: [],
};

function onWall(x = 0): CatController {
  const c = new CatController(world, 0.4);
  c.x = x;
  c.z = 5;
  c.y = 1.36;
  c.heading = Math.PI / 2;
  return c;
}

/** 뛰기 시작할 때까지 민다. 뛰기 전 최저 높이와 프레임 수를 돌려준다 */
function pushUntilJump(c: CatController, dx: number, dz: number, max = 300) {
  let minY = c.y;
  let frames = 0;
  for (; frames < max && !c.jumping; frames++) {
    c.moveDirect(dx, dz, dt);
    if (!c.jumping) minY = Math.min(minY, c.y);
  }
  return { minY, frames };
}

function finishJump(c: CatController) {
  for (let i = 0; i < 300 && (c.jumping || c.y > 0); i++) c.brake(dt);
}

describe('담 위 걷기 (J-3)', () => {
  it('좁은 담 위에서 비스듬히 밀면 몸을 담 방향으로 돌려 담을 따라 걷는다', () => {
    const c = onWall();
    for (let i = 0; i < 90; i++) c.moveDirect(1, -0.5, dt);
    expect(Math.abs(c.heading - Math.PI / 2)).toBeLessThan(0.1);
    expect(c.x).toBeGreaterThan(0.4);
    expect(c.y).toBeCloseTo(1.36);
  });

  it('반대쪽으로 비스듬히 밀면 반대 방향(−x)으로 맞춘다', () => {
    const c = onWall();
    for (let i = 0; i < 150; i++) c.moveDirect(-1, 0.5, dt);
    expect(Math.abs(Math.abs(c.heading) - Math.PI / 2)).toBeLessThan(0.1);
    expect(c.heading).toBeLessThan(0);
    expect(c.x).toBeLessThan(-0.3);
  });

  it('넓은 윗면(평상)에서는 미는 방향 그대로 걷는다', () => {
    const c = new CatController(world, 0.4);
    c.x = 9;
    c.z = 0;
    c.y = 0.5;
    c.heading = 0;
    for (let i = 0; i < 40; i++) c.moveDirect(1, 1, dt);
    expect(c.heading).toBeCloseTo(Math.PI / 4, 1);
  });
});

describe('밀어서 뛰어내리기 (J-3)', () => {
  it('길 쪽 가장자리로 계속 밀면 잠깐 멈췄다가 길로 뛰어내린다', () => {
    const c = onWall();
    c.heading = Math.PI;
    const { minY, frames } = pushUntilJump(c, 0, -1);
    expect(c.jumping).toBe(true);
    expect(minY).toBeCloseTo(1.36); // 뛰기 전에는 떨어지지 않는다
    expect(frames).toBeGreaterThan(20); // 닿자마자 뛰지 않는다
    finishJump(c);
    expect(c.y).toBe(0);
    expect(c.z).toBeLessThan(4.87);
  });

  it('담 끝에서 계속 밀면 끝 너머로 뛰어내린다', () => {
    const c = onWall(4.5);
    const { minY } = pushUntilJump(c, 1, 0);
    expect(c.jumping).toBe(true);
    expect(minY).toBeCloseTo(1.36);
    finishJump(c);
    expect(c.y).toBe(0);
    expect(c.x).toBeGreaterThan(5);
  });

  it('건물 쪽으로는 아무리 밀어도 뛰지 않는다', () => {
    const c = onWall();
    c.heading = 0;
    pushUntilJump(c, 0, 1, 180);
    expect(c.jumping).toBe(false);
    expect(c.y).toBeCloseTo(1.36);
  });

  it('캣캠(탱크식) 전진으로 가장자리를 밀어도 뛰어내린다', () => {
    const c = onWall();
    c.heading = Math.PI;
    for (let i = 0; i < 300 && !c.jumping; i++) c.moveTank(0, 1, dt);
    expect(c.jumping).toBe(true);
    finishJump(c);
    expect(c.y).toBe(0);
  });

  it('바닥에서 벽을 밀어도 뛰지 않는다 (점프는 Space로만)', () => {
    const c = new CatController(world, 0.4);
    c.z = 4;
    for (let i = 0; i < 180; i++) c.moveDirect(0, 1, dt);
    expect(c.jumping).toBe(false);
    expect(c.y).toBe(0);
  });
});
