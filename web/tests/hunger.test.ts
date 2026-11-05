import { describe, expect, it } from 'vitest';
import { feed, hungerLabel, tickHunger } from '../src/systems/hunger';

describe('hunger', () => {
  it('시간이 지나면 천천히 줄어든다', () => {
    const v = tickHunger(100, 10, 'active');
    expect(v).toBeLessThan(100);
    expect(v).toBeGreaterThan(95);
  });

  it('낮잠 중에는 활동 중보다 덜 줄어든다', () => {
    expect(tickHunger(100, 60, 'nap')).toBeGreaterThan(tickHunger(100, 60, 'active'));
  });

  it('0 아래로 내려가지 않는다 (압박 요소 없음)', () => {
    expect(tickHunger(1, 1000, 'active')).toBe(0);
  });

  it('먹으면 회복되고 100을 넘지 않는다', () => {
    expect(feed(30)).toBeGreaterThan(30);
    expect(feed(90)).toBe(100);
  });

  it('상태 문구를 돌려준다', () => {
    expect(hungerLabel(90)).toBe('배부름');
    expect(hungerLabel(50)).toBe('보통');
    expect(hungerLabel(10)).toBe('출출함');
  });
});
