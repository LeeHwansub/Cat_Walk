import { describe, expect, it } from 'vitest';
import { CatController } from '../src/cat/CatController';
import { findLanding, jumpArcY, JUMP, jumpWeights } from '../src/cat/jump';
import { JUMP_POSES } from '../src/cat/liePoses';
import { groundAt, isFree, type CollisionWorld } from '../src/world/collision';

const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const dt = 1 / 60;
const R = 0.16;

/** 고양이 앞(+z) 0.6m에 담(윗면 1.36, 폭 0.26). 그 뒤는 건물(올라설 수 없음). 왼쪽(−x)에 차 보닛(0.97) */
const world: CollisionWorld = {
  bounds,
  rects: [
    { minX: -3, maxX: 3, minZ: 0.6, maxZ: 0.86, top: 1.36 },
    { minX: -3, maxX: 3, minZ: 0.86, maxZ: 5 },
    { minX: -8, maxX: -6, minZ: -1, maxZ: 1, top: 0.97 },
    { minX: 10, maxX: 12, minZ: -1, maxZ: 1, top: 1.9 },
  ],
  circles: [],
};

describe('착지할 곳 찾기 (findLanding)', () => {
  it('앞에 올라설 수 있는 담이 있으면 담 윗면 위로', () => {
    const l = findLanding(world, 0, 0, 0, 0, 1, R)!;
    expect(l).toBeTruthy();
    expect(l.y).toBeCloseTo(1.36);
    expect(groundAt(world, l.x, l.z, l.y)).toBeCloseTo(1.36);
    expect(isFree(world, l.x, l.z, R, l.y)).toBe(true);
  });

  it('차 보닛 위로 (−x 방향)', () => {
    const l = findLanding(world, -5.3, 0, 0, -Math.PI / 2, 1, R)!;
    expect(l.y).toBeCloseTo(0.97);
  });

  it('너무 높은 곳(1.9m)이나 너무 먼 곳에는 뛰지 않는다', () => {
    expect(findLanding(world, 9.4, 0, 0, Math.PI / 2, 1, R)?.y ?? 0).toBe(0);
    expect(findLanding(world, 0, -2, 0, 0, 1, R)?.y ?? 0).toBe(0); // 담까지 2.6m
  });

  it('작은 고양이는 덜 높이 뛴다 (크기 0.6이면 담 1.36에 못 오름)', () => {
    expect(findLanding(world, 0, 0, 0, 0, 0.6, R * 0.6)?.y ?? 0).toBe(0);
  });

  it('높은 곳에서는 앞쪽 낮은 바닥으로 뛰어내린다 (건물 쪽은 막힘)', () => {
    const down = findLanding(world, 0, 0.73, 1.36, Math.PI, 1, R)!; // 길 쪽(−z)
    expect(down.y).toBe(0);
    expect(down.z).toBeLessThan(0.6 - R);
    expect(findLanding(world, 0, 0.73, 1.36, 0, 1, R)).toBeNull(); // 건물 쪽은 갈 곳 없음
  });

  it('바닥에서 앞에 올라설 곳이 없으면 null (제자리 뛰기)', () => {
    expect(findLanding(world, 0, -5, 0, Math.PI, 1, R)).toBeNull();
  });
});

describe('점프 궤적과 자세 비율', () => {
  it('포물선: 시작·끝 높이를 지나고, 올라갈 때는 끝에서 내려오며 닿는다(담 모서리를 아래에서 뚫지 않게)', () => {
    expect(jumpArcY(0, 1.36, 0, 1)).toBeCloseTo(0);
    expect(jumpArcY(0, 1.36, 1, 1)).toBeCloseTo(1.36);
    expect(jumpArcY(0, 1.36, 0.97, 1)).toBeGreaterThan(1.36);
    expect(jumpArcY(1.36, 0, 0.5, 1)).toBeGreaterThan(0.68);
  });

  it('단계마다 자세 비율: 웅크리기 → 도약 → 공중 → 착지', () => {
    expect(jumpWeights('crouch', 1).crouch).toBeCloseTo(1);
    expect(jumpWeights('air', 0.05).launch).toBeGreaterThan(0.8);
    expect(jumpWeights('air', 0.55).air).toBeGreaterThan(0.8);
    expect(jumpWeights('air', 0.98).land).toBeGreaterThan(0.6);
    expect(jumpWeights('land', 0).land).toBeCloseTo(1);
    expect(jumpWeights('land', 1).land).toBeCloseTo(0);
  });

  it('자세 파일 이름 네 개', () => {
    expect([...JUMP_POSES]).toEqual(['jumpCrouch', 'jumpLaunch', 'jumpAir', 'jumpLand']);
  });
});

describe('고양이 점프 (CatController)', () => {
  function jumpUntilDone(c: CatController) {
    for (let i = 0; i < 240 && c.jumping; i++) c.brake(dt);
  }

  it('담 앞에서 점프하면 담 위에 서고, 다시 길 쪽으로 뛰어내린다', () => {
    const c = new CatController(world, 0.4);
    expect(c.jump()).toBe(true);
    expect(c.jumping).toBe(true);
    jumpUntilDone(c);
    expect(c.jumping).toBe(false);
    expect(c.y).toBeCloseTo(1.36);
    expect(c.z).toBeGreaterThan(0.6);
    expect(c.z).toBeLessThan(0.86);
    c.heading = Math.PI;
    c.jump();
    jumpUntilDone(c);
    expect(c.y).toBe(0);
    expect(c.z).toBeLessThan(0.6);
  });

  it('점프 중에는 이동 입력으로 방향·위치가 바뀌지 않는다', () => {
    const c = new CatController(world, 0.4);
    c.jump();
    const h = c.heading;
    for (let i = 0; i < 5; i++) c.moveDirect(1, 0, dt);
    expect(c.heading).toBe(h);
    expect(c.x).toBe(0);
  });

  it('갈 곳이 없으면 제자리에서 짧게 뛰고 같은 자리로 내려온다', () => {
    const c = new CatController(world, 0.4);
    c.x = 0;
    c.z = -5;
    c.heading = Math.PI;
    expect(c.jump()).toBe(true);
    let peak = 0;
    for (let i = 0; i < 240 && c.jumping; i++) {
      c.brake(dt);
      peak = Math.max(peak, c.y);
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(c.y).toBe(0);
    expect(c.z).toBeCloseTo(-5);
  });

  it('점프 중에는 다시 점프하지 않는다', () => {
    const c = new CatController(world, 0.4);
    c.jump();
    expect(c.jump()).toBe(false);
  });

  it('점프 높이 한계는 성체 1.5m', () => {
    expect(JUMP.maxUp).toBeCloseTo(1.5);
  });
});

describe('점프 자세 연결', () => {
  it('애니메이터는 점프 자세 비율을 그대로 넘긴다 (지연 없이)', async () => {
    const { CatAnimator } = await import('../src/cat/CatAnimator');
    const a = new CatAnimator();
    const base = { behavior: 'idle' as const, progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false };
    const p = a.update({ ...base, jump: { crouch: 0.2, launch: 0.9, air: 0.1, land: 0 } }, 1 / 60);
    expect(p.jumpCrouch).toBeCloseTo(0.2);
    expect(p.jumpLaunch).toBeCloseTo(0.9);
    expect(p.jumpAir).toBeCloseTo(0.1);
    expect(p.jumpLand).toBe(0);
    expect(a.update(base, 1 / 60).jumpLaunch).toBe(0);
  });

  it('자세 파일에 점프 자세 네 개가 있고, 자세에 쓰는 뼈마다 회전 트랙이 있다', async () => {
    const { LIE_POSE_BONES } = await import('../src/cat/liePoses');
    const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(p: string): Uint8Array } } }).process.getBuiltinModule('node:fs');
    const bytes = new Uint8Array(fs.readFileSync('public/assets/models/cat-poses.glb'));
    const len = new DataView(bytes.buffer).getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len))) as {
      nodes: { name: string }[];
      animations: { name: string; channels: { target: { node: number; path: string } }[] }[];
    };
    for (const name of JUMP_POSES) {
      const anim = gltf.animations.find((x) => x.name === name);
      expect(anim, name).toBeTruthy();
      const rotated = new Set(anim!.channels.filter((c) => c.target.path === 'rotation').map((c) => gltf.nodes[c.target.node].name));
      for (const bone of LIE_POSE_BONES) expect(rotated.has(bone), `${name} ${bone}`).toBe(true);
    }
  });
});
