import { describe, expect, it } from 'vitest';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { LIE_POSE_BONES, LIE_POSES } from '../src/cat/liePoses';

/** Node 내장 fs (프로젝트 타입 검사에 Node 타입이 없어 필요한 부분만 적는다) */
const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(p: string): Uint8Array } } }).process.getBuiltinModule('node:fs');

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

function run(a: CatAnimator, over: Partial<AnimInput>, seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) a.update(input(over), dt);
  return a.pose;
}

describe('누운 자세 (Blender로 만든 cat-poses.glb)', () => {
  it('자세 다섯 개: 배 보이기·옆으로 눕기·식빵·낮잠·꼬리 감기', () => {
    expect([...LIE_POSES]).toEqual(['bellyUp', 'sideLie', 'loafPose', 'napPose', 'wrapPose']);
  });

  it('배 보이기 중에는 배 보이기 자세 비율이 1로 올라간다', () => {
    const p = run(new CatAnimator(), { behavior: 'bellyUp', progress: 0.5 }, 3);
    expect(p.bellyUp).toBeGreaterThan(0.95);
    expect(p.sideLie).toBeLessThan(0.05);
  });

  it('옆으로 눕기 중에는 옆으로 눕기 자세 비율이 1로 올라간다', () => {
    const p = run(new CatAnimator(), { behavior: 'sideLie', progress: 0.5 }, 3);
    expect(p.sideLie).toBeGreaterThan(0.95);
    expect(p.bellyUp).toBeLessThan(0.05);
  });

  it('식빵·낮잠·꼬리 감기는 각자 자세 비율이 1로 올라간다 (다리를 몸 밑에 묻지 않게 Blender 자세로)', () => {
    for (const [behavior, field] of [['loaf', 'loafPose'], ['nap', 'napPose'], ['tailWrap', 'wrapPose']] as const) {
      const p = run(new CatAnimator(), { behavior, progress: 0.5 }, 3);
      expect(p[field], behavior).toBeGreaterThan(0.95);
      for (const other of ['bellyUp', 'sideLie', 'loafPose', 'napPose', 'wrapPose'] as const) if (other !== field) expect(p[other], `${behavior} ${other}`).toBeLessThan(0.05);
    }
  });

  it('다른 행동으로 바뀌면 다시 0으로 내려간다', () => {
    const a = new CatAnimator();
    run(a, { behavior: 'bellyUp', progress: 0.5 }, 3);
    const p = run(a, { behavior: 'idle' }, 3);
    expect(p.bellyUp).toBeLessThan(0.05);
  });

  it('쓰다듬기·떠 있기·일어서기 중에는 누운 자세를 하지 않는다', () => {
    for (const over of [{ petted: true }, { floating: 1 }, { standingUp: true }] as Partial<AnimInput>[]) {
      const p = run(new CatAnimator(), { behavior: 'sideLie', progress: 0.5, ...over }, 3);
      expect(p.sideLie).toBeLessThan(0.05);
    }
  });

  it('자세 파일에 두 자세가 있고, 자세에 쓰는 뼈마다 회전 트랙이 있다', () => {
    const bytes = new Uint8Array(fs.readFileSync('public/assets/models/cat-poses.glb'));
    const len = new DataView(bytes.buffer).getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len))) as {
      nodes: { name: string }[];
      animations: { name: string; channels: { target: { node: number; path: string } }[] }[];
    };
    for (const name of LIE_POSES) {
      const anim = gltf.animations.find((a) => a.name === name);
      expect(anim, name).toBeTruthy();
      const rotated = new Set(anim!.channels.filter((c) => c.target.path === 'rotation').map((c) => gltf.nodes[c.target.node].name));
      for (const bone of LIE_POSE_BONES) expect(rotated.has(bone), `${name} ${bone}`).toBe(true);
    }
  });

  it('꼬리·귀는 자세에 넣지 않는다 (코드가 계속 흔든다)', () => {
    expect(LIE_POSE_BONES.some((b) => /tail|ear|eye|mouth/.test(b))).toBe(false);
  });
});
