import { describe, expect, it } from 'vitest';
import { sampleSnapshots, shouldSend, type Snapshot } from '../src/net/interp';
import type { CatState } from '../src/net/protocol';

const s = (over: Partial<CatState> = {}): CatState => ({ x: 0, z: 0, y: 0, h: 0, p: 0, b: 'walk', v: 0.5, g: 0, ...over });

describe('다른 고양이 보간 (받은 상태 사이를 부드럽게)', () => {
  const snaps: Snapshot[] = [
    { t: 1, s: s({ x: 0, h: 3.0, b: 'walk' }) },
    { t: 1.2, s: s({ x: 1, h: -3.0, b: 'sit' }) },
  ];

  it('두 상태 사이 시각이면 위치를 선형으로 잇고, 방향은 짧은 쪽으로 돈다', () => {
    const r = sampleSnapshots(snaps, 1.1)!;
    expect(r.x).toBeCloseTo(0.5);
    // 3.0 → −3.0은 π를 넘어 짧게 (0.28 rad 차이): 가운데는 ±π 근처
    expect(Math.abs(Math.abs(r.h) - Math.PI)).toBeLessThan(0.05);
  });

  it('행동은 그 시각 전의 마지막 상태를 따른다', () => {
    expect(sampleSnapshots(snaps, 1.1)!.b).toBe('walk');
    expect(sampleSnapshots(snaps, 1.25)!.b).toBe('sit');
  });

  it('처음보다 앞이면 첫 상태, 마지막보다 뒤면 마지막 상태에 머문다 (앞질러 짐작하지 않는다)', () => {
    expect(sampleSnapshots(snaps, 0)!.x).toBe(0);
    expect(sampleSnapshots(snaps, 9)!.x).toBe(1);
    expect(sampleSnapshots([], 1)).toBeNull();
  });

  it('한 번에 3m 넘게 옮겨 가면(맵 바꿈·다시 시작) 잇지 않고 바로 옮긴다', () => {
    const jump: Snapshot[] = [
      { t: 1, s: s({ x: 0 }) },
      { t: 1.2, s: s({ x: 20 }) },
    ];
    expect(sampleSnapshots(jump, 1.1)!.x).toBe(0);
    expect(sampleSnapshots(jump, 1.2)!.x).toBe(20);
  });
});

describe('내 상태 보내기 규칙 (메시지를 아낀다: 바뀔 때만, 1초에 8번까지)', () => {
  it('처음에는 보낸다', () => {
    expect(shouldSend(null, s(), 0)).toBe(true);
  });

  it('가만히 있으면 보내지 않는다', () => {
    expect(shouldSend(s(), s({ x: 0.005 }), 1)).toBe(false);
  });

  it('움직이거나 돌거나 자세가 바뀌면 보낸다. 단 마지막으로 보낸 지 1/8초가 지나야', () => {
    expect(shouldSend(s(), s({ x: 0.1 }), 0.2)).toBe(true);
    expect(shouldSend(s(), s({ h: 0.1 }), 0.2)).toBe(true);
    expect(shouldSend(s(), s({ b: 'sit' }), 0.2)).toBe(true);
    expect(shouldSend(s(), s({ x: 0.1 }), 0.05)).toBe(false);
  });

  it('자세가 바뀐 것은 1/8초를 기다리지 않고 바로 보낸다', () => {
    expect(shouldSend(s(), s({ b: 'loaf' }), 0.01)).toBe(true);
  });
});
