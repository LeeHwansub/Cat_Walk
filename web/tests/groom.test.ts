import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { ClipRetarget, GROOM_BONE_MAP, RUN_BONE_MAP } from '../src/cat/retarget';

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}

function run(a: CatAnimator, over: Partial<AnimInput>, seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) a.update(input(over), dt);
  return a.pose;
}

describe('그루밍 동작 (사용자 제공 grumming.glb 옮기기)', () => {
  it('그루밍 중에는 그루밍 동작 비율이 1로 올라가고, 진행 위치를 그대로 넘긴다', () => {
    const a = new CatAnimator();
    const p = run(a, { behavior: 'groom', progress: 0.4 }, 2);
    expect(p.groom).toBeGreaterThan(0.95);
    expect(p.groomPhase).toBeCloseTo(0.4);
    expect(p.sit).toBeGreaterThan(0.9); // 앉아서 한다
  });

  it('그루밍이 끝나면 비율이 다시 0으로 내려간다', () => {
    const a = new CatAnimator();
    run(a, { behavior: 'groom', progress: 0.5 }, 2);
    const p = run(a, { behavior: 'idle' }, 2);
    expect(p.groom).toBeLessThan(0.05);
  });

  it('쓰다듬거나 떠 있으면 그루밍 동작을 하지 않는다', () => {
    expect(run(new CatAnimator(), { behavior: 'groom', progress: 0.5, petted: true }, 2).groom).toBeLessThan(0.05);
    expect(run(new CatAnimator(), { behavior: 'groom', progress: 0.5, floating: 1 }, 2).groom).toBeLessThan(0.05);
  });

  it('뼈 짝: 다리·몸통·머리·꼬리를 모두 옮기고, 대상 뼈는 겹치지 않는다', () => {
    const targets = GROOM_BONE_MAP.map(([, t]) => t);
    expect(new Set(targets).size).toBe(targets.length);
    for (const t of ['torso_02', 'head_018', 'leg.upper.F.L_014', 'leg.upper.F.R_024', 'thigh.B.L_03', 'tail_07']) expect(targets).toContain(t);
    expect(RUN_BONE_MAP.length).toBeGreaterThan(0);
  });

  it('높이 기준 뼈 이름을 바꿀 수 있다 (그루밍 원본은 pelvis가 없다)', () => {
    const scene = new THREE.Group();
    const body = new THREE.Object3D();
    body.name = 'j_body_00_12';
    body.position.y = 0.3;
    scene.add(body);
    const clip = new THREE.AnimationClip('g', 1, [new THREE.VectorKeyframeTrack('j_body_00_12.position', [0, 1], [0, 0.3, 0, 0, 0.25, 0])]);
    const r = new ClipRetarget(scene, clip, [['j_body_00_12', 'torso_02']], undefined, 'j_body_00_12');
    expect(r.pelvisRestY).toBeCloseTo(0.3);
    expect(r.sample(1, new Map())).toBeCloseTo(-0.05);
  });
});
