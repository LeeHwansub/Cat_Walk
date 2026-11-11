import { describe, expect, it } from 'vitest';
import { Input } from '../src/core/input';

function key(target: EventTarget, type: 'keydown' | 'keyup', code: string) {
  const e = new Event(type) as Event & { code: string };
  e.code = code;
  target.dispatchEvent(e);
}

describe('입력: 키보드 + 모바일 조이스틱', () => {
  it('조이스틱 방향이 이동이 된다', () => {
    const t = new EventTarget();
    const input = new Input(t as unknown as Window);
    input.setStick({ x: 0.5, z: 0.6, mag: 0.8 });
    expect(input.move()).toEqual({ x: 0.5, z: 0.6 });
    input.setStick({ x: 0, z: 0, mag: 0 });
    expect(input.move()).toEqual({ x: 0, z: 0 });
  });

  it('키보드를 누르고 있으면 키보드가 우선한다', () => {
    const t = new EventTarget();
    const input = new Input(t as unknown as Window);
    input.setStick({ x: 0.5, z: 0.6, mag: 0.8 });
    key(t, 'keydown', 'KeyW');
    expect(input.move()).toEqual({ x: 0, z: 1 });
  });

  it('조이스틱을 끝까지 밀면 달리기, 덜 밀면 걷기', () => {
    const t = new EventTarget();
    const input = new Input(t as unknown as Window);
    input.setStick({ x: 0, z: 0.7, mag: 0.7 });
    expect(input.running()).toBe(false);
    input.setStick({ x: 0, z: 1, mag: 1 });
    expect(input.running()).toBe(true);
  });

  it('Shift는 그대로 달리기', () => {
    const t = new EventTarget();
    const input = new Input(t as unknown as Window);
    key(t, 'keydown', 'ShiftLeft');
    expect(input.running()).toBe(true);
  });
});
