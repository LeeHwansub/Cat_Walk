import { describe, expect, it } from 'vitest';
import { Precipitation, RAIN_BOX, SNOW_BOX } from '../src/world/precipitation';

describe('비·눈 입자 (날씨, 2026-11-16)', () => {
  it('맑음이면 아무것도 보이지 않고, 비·눈은 하나씩만 보인다', () => {
    const p = new Precipitation();
    expect(p.rain.visible).toBe(false);
    expect(p.snow.visible).toBe(false);
    p.setKind('rain');
    expect([p.rain.visible, p.snow.visible]).toEqual([true, false]);
    p.setKind('snow');
    expect([p.rain.visible, p.snow.visible]).toEqual([false, true]);
    p.setKind('clear');
    expect([p.rain.visible, p.snow.visible]).toEqual([false, false]);
  });

  it('모바일을 생각해 입자 수를 묶어 둔다 (그리기 1회씩)', () => {
    const p = new Precipitation();
    expect(p.rain.geometry.getAttribute('position').count / 2).toBeLessThanOrEqual(1500); // 빗줄기 하나 = 점 2개
    expect(p.snow.geometry.getAttribute('position').count).toBeLessThanOrEqual(1400);
  });

  it('눈송이가 천천히 내리고, 바닥에 닿으면 위로 돌아간다', () => {
    const p = new Precipitation();
    p.setKind('snow');
    const pos = p.snow.geometry.getAttribute('position');
    const y0 = pos.getY(0);
    p.update(0.1, 0, 0);
    expect(pos.getY(0)).toBeLessThan(y0);
    expect(y0 - pos.getY(0)).toBeLessThan(0.2);
    for (let i = 0; i < 400; i++) p.update(0.1, 0, 0);
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeGreaterThanOrEqual(0);
  });

  it('빗줄기는 빠르게 떨어지는 짧은 선이다', () => {
    const p = new Precipitation();
    p.setKind('rain');
    const pos = p.rain.geometry.getAttribute('position');
    const top0 = pos.getY(0);
    p.update(0.05, 0, 0);
    const fell = top0 - pos.getY(0);
    expect(fell).toBeGreaterThan(0.4); // 초속 10m 넘게
    const len = pos.getY(0) - pos.getY(1);
    expect(len).toBeGreaterThan(0.2);
    expect(len).toBeLessThan(0.8);
    for (let i = 0; i < 200; i++) p.update(0.05, 0, 0);
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBeGreaterThanOrEqual(-0.8);
  });

  it('고양이를 따라간다: 멀리 가도 입자가 고양이 둘레 상자 안에 있다', () => {
    const p = new Precipitation();
    for (const kind of ['rain', 'snow'] as const) {
      p.setKind(kind);
      const obj = kind === 'rain' ? p.rain : p.snow;
      const box = kind === 'rain' ? RAIN_BOX : SNOW_BOX;
      p.update(0.05, 40, -25);
      const pos = obj.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        expect(Math.abs(pos.getX(i) - 40)).toBeLessThanOrEqual(box.w / 2 + 0.01);
        expect(Math.abs(pos.getZ(i) + 25)).toBeLessThanOrEqual(box.d / 2 + 0.01);
      }
    }
  });

  it('보이지 않는 입자는 움직이지 않는다 (맑은 날 계산 아끼기)', () => {
    const p = new Precipitation();
    const pos = p.snow.geometry.getAttribute('position');
    const y0 = pos.getY(0);
    p.update(0.1, 0, 0);
    expect(pos.getY(0)).toBe(y0);
  });
});
