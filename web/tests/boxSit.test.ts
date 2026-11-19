import { describe, expect, it } from 'vitest';
import { BOX_FLOOR, BOX_SIT_DELAY, nextBoxStill, staysInBox } from '../src/behavior/box';
import { behaviorWeights } from '../src/behavior/selector';
import { CatAnimator, type AnimInput } from '../src/cat/CatAnimator';
import { findLanding } from '../src/cat/jump';
import { LIE_POSES } from '../src/cat/liePoses';
import { groundAt, isFree, pathClear, STEP_UP } from '../src/world/collision';
import { mapById } from '../src/world/maps';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

function input(over: Partial<AnimInput> = {}): AnimInput {
  return { behavior: 'idle', progress: 0.5, elapsed: 5, speed: 0, turnRate: 0, gaitPhase: 0, petted: false, ...over };
}
function run(a: CatAnimator, over: Partial<AnimInput>, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) a.update(input(over), 1 / 60);
  return a.pose;
}

describe('상자에 쏙 (보드 X-05, 5단계 ③)', () => {
  const xmas = mapById('xmas').build({});
  const BOX = { x: 2.6, z: -1.9 };

  it('Blender 자세 boxSit이 자세 목록에 있다 (cat-poses.glb, 기존 자세 9개는 그대로)', () => {
    expect(LIE_POSES).toContain('boxSit');
  });

  it('빈 상자는 걸어서 못 들어가고(벽), 안쪽 바닥은 턱보다 높아 뛰어 들어간다', () => {
    expect(BOX_FLOOR).toBeGreaterThan(STEP_UP);
    expect(BOX_FLOOR).toBeLessThan(0.4 - 0.12); // 앉으면 귀·눈이 벽(0.4m) 위로
    expect(groundAt(xmas.collision, BOX.x, BOX.z, 0)).toBe(0); // 땅에서는 안쪽 바닥에 못 올라선다
    expect(groundAt(xmas.collision, BOX.x, BOX.z, BOX_FLOOR)).toBeCloseTo(BOX_FLOOR, 2);
    expect(pathClear(xmas.collision, BOX.x, BOX.z - 1, BOX.x, BOX.z, 0.16)).toBe(false);
    const land = findLanding(xmas.collision, BOX.x, BOX.z + 0.75, 0, Math.PI, 1, 0.16); // 북쪽(뚜껑 반대편)에서 상자 쪽으로
    expect(land).not.toBeNull();
    expect(land!.y).toBeCloseTo(BOX_FLOOR, 2);
    expect(Math.hypot(land!.x - BOX.x, land!.z - BOX.z)).toBeLessThan(0.3);
  });

  it('기대 세운 뚜껑(남동쪽)은 막힌 벽: 지나가거나 넘어 들어갈 수 없다', () => {
    expect(isFree(xmas.collision, 2.81, -2.28, 0.1)).toBe(false);
    const over = findLanding(xmas.collision, 2.95, -2.75, 0, -0.5, 1, 0.16); // 뚜껑 쪽에서 상자 쪽으로
    expect(over === null || over.y < STEP_UP).toBe(true);
  });

  it('상자는 쉬는 자리: 관심 지점 box, 근처에서는 쉬는 행동이 늘어난다', () => {
    const box = xmas.interests.find((i) => i.kind === 'box');
    expect(box).toMatchObject({ x: BOX.x, z: BOX.z });
    const base = behaviorWeights({ now: 100, last: 'sit', activeTime: 0, nearby: [], hunger: 100, cooldowns: {} });
    const inBox = behaviorWeights({ now: 100, last: 'sit', activeTime: 0, nearby: ['box'], hunger: 100, cooldowns: {} });
    expect(inBox.sit).toBeGreaterThan(base.sit);
    expect(inBox.walk).toBeLessThan(base.walk);
  });

  it('상자 안에서 1.5초 멈춰 있으면 앉는다: 움직이거나 상자를 나가면 처음부터', () => {
    expect(BOX_SIT_DELAY).toBe(1.5);
    let s = 0;
    for (let i = 0; i < 14; i++) s = nextBoxStill(s, 0.1, true, 0);
    expect(s).toBeLessThan(BOX_SIT_DELAY);
    s = nextBoxStill(s, 0.2, true, 0);
    expect(s).toBeGreaterThanOrEqual(BOX_SIT_DELAY);
    expect(nextBoxStill(s, 0.1, true, 0.3)).toBe(0); // 움직임
    expect(nextBoxStill(s, 0.1, false, 0)).toBe(0); // 상자 밖
  });

  it('자동 생활: 상자 안에서는 쉬는 동안 뛰어내리지 않고, 걷기로 바뀌면 폴짝 나온다', () => {
    expect(staysInBox(true, 'sit')).toBe(true);
    expect(staysInBox(true, 'loaf')).toBe(true);
    expect(staysInBox(true, 'walk')).toBe(false);
    expect(staysInBox(false, 'sit')).toBe(false); // 담 위 등 다른 높은 곳은 지금처럼 뛰어내린다
  });

  it('상자 앉기 중에는 boxSit 자세가 1로, 다른 누운 자세는 0으로', () => {
    const p = run(new CatAnimator(), { behavior: 'sit', boxSit: true }, 3);
    expect(p.boxSit).toBeGreaterThan(0.95);
    for (const other of ['bellyUp', 'sideLie', 'loafPose', 'napPose', 'wrapPose'] as const) expect(p[other], other).toBeLessThan(0.05);
  });

  it('움직이려고 일어서면 상자 자세를 바로 푼다 (폴짝 나오기)', () => {
    const a = new CatAnimator();
    run(a, { boxSit: true }, 3);
    const p = run(a, { boxSit: false, standingUp: true }, 0.5);
    expect(p.boxSit).toBeLessThan(0.1);
  });
});
