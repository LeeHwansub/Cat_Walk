import { describe, expect, it } from 'vitest';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { gazeAngles, GazePicker, MAX_GAZE_YAW } from '../src/cat/gaze';
import { createRng } from '../src/core/rng';

const cat = (heading = 0) => ({ x: 0, z: 0, heading, eyeY: 0.25 });

describe('gazeAngles (바라볼 방향)', () => {
  it('정면의 대상은 고개를 돌리지 않는다', () => {
    expect(gazeAngles(cat(), { x: 0, y: 0.25, z: 3 }).yaw).toBeCloseTo(0, 5);
  });

  it('왼쪽(+x) 대상은 + 방향, 오른쪽은 - 방향으로 돌린다', () => {
    expect(gazeAngles(cat(), { x: 1, y: 0.25, z: 2 }).yaw).toBeGreaterThan(0);
    expect(gazeAngles(cat(), { x: -1, y: 0.25, z: 2 }).yaw).toBeLessThan(0);
  });

  it('고양이가 향한 방향을 기준으로 계산한다', () => {
    // 동쪽(+x)을 보는 고양이에게 +x 쪽 대상은 정면
    expect(gazeAngles(cat(Math.PI / 2), { x: 3, y: 0.25, z: 0 }).yaw).toBeCloseTo(0, 5);
  });

  it('고개 돌림은 한계 각도를 넘지 않는다', () => {
    expect(Math.abs(gazeAngles(cat(), { x: 2, y: 0.25, z: 0.1 }).yaw)).toBeLessThanOrEqual(MAX_GAZE_YAW);
  });

  it('높은 곳(사람 얼굴)은 올려다보고(- pitch), 바닥은 내려다본다(+ pitch)', () => {
    expect(gazeAngles(cat(), { x: 0, y: 1.6, z: 2 }).pitch).toBeLessThan(0);
    expect(gazeAngles(cat(), { x: 0, y: 0, z: 1 }).pitch).toBeGreaterThan(0);
  });
});

describe('GazePicker (무엇을 바라볼지)', () => {
  it('가까운 대상만 고르고, 등 뒤 대상은 고르지 않는다', () => {
    const g = new GazePicker(createRng(1));
    for (let t = 0; t < 60; t += 0.5) {
      const target = g.update(t, cat(), [
        { x: 0, y: 0.2, z: -2 }, // 등 뒤
        { x: 0, y: 0.2, z: 20 }, // 너무 멂
      ]);
      expect(target).toBeNull();
    }
  });

  it('한 대상을 몇 초 동안 바라보다 바꾸거나 쉬고, 같은 대상만 계속 보지 않는다', () => {
    const g = new GazePicker(createRng(2));
    const items = [
      { x: 1, y: 0.2, z: 2 },
      { x: -1, y: 0.2, z: 2 },
    ];
    const seq: (number | null)[] = [];
    for (let t = 0; t < 120; t += 0.5) {
      const target = g.update(t, cat(), items);
      seq.push(target ? items.indexOf(target) : null);
    }
    // 바뀌는 횟수: 너무 자주(매 프레임) 바뀌지도, 전혀 바뀌지 않지도 않는다
    let changes = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) changes++;
    expect(changes).toBeGreaterThan(8);
    expect(changes).toBeLessThan(80);
    expect(seq).toContain(0);
    expect(seq).toContain(1);
    expect(seq).toContain(null); // 가끔은 아무것도 보지 않는다
  });
});

describe('CatAnimator 시선', () => {
  const input = (over: Partial<AnimInput> = {}): AnimInput => ({ behavior: 'idle', progress: 0, elapsed: 0, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over });
  const run = (over: Partial<AnimInput>) => {
    const a = new CatAnimator();
    for (let i = 0; i < 180; i++) a.update(input({ elapsed: i / 60, ...over }), 1 / 60);
    return a.pose;
  };

  it('쉬는 중에는 바라볼 대상 쪽으로 고개를 돌린다', () => {
    const p = run({ behavior: 'sit', gaze: { yaw: 0.8, pitch: 0 } });
    expect(p.headYaw).toBeGreaterThan(0.5);
  });

  it('고개로 다 못 돌린 만큼은 눈동자가 따라간다 (한계 있음)', () => {
    const p = run({ behavior: 'sit', gaze: { yaw: 1.2, pitch: 0 } });
    expect(p.eyeYaw).toBeGreaterThan(0.05);
    expect(p.eyeYaw).toBeLessThanOrEqual(0.3);
  });

  it('그루밍·먹기·냄새 맡기 중에는 시선 대상을 무시한다', () => {
    for (const behavior of ['groom', 'eat', 'sniff'] as const) {
      const p = run({ behavior, gaze: { yaw: 1, pitch: 0 }, progress: 0.3 });
      expect(Math.abs(p.headYaw), behavior).toBeLessThan(0.4);
      expect(Math.abs(p.eyeYaw), behavior).toBeLessThan(0.02);
    }
  });

  it('눈을 감으면 눈동자 움직임도 멈춘다', () => {
    const p = run({ behavior: 'nap', progress: 0.5, gaze: { yaw: 1, pitch: 0 } });
    expect(Math.abs(p.eyeYaw)).toBeLessThan(0.02);
  });
});
