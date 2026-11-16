import { describe, expect, it } from 'vitest';
import { skyButton, skyOptions } from '../src/ui/skyMenu';

describe('시간·날씨 아이콘 (오른쪽 위, 사용자 요청 2026-11-16)', () => {
  it('아이콘은 지금 시간대를 보이고, 비·눈이면 작은 표시가 붙는다', () => {
    expect(skyButton('day', 'clear')).toEqual({ icon: '☀️', badge: '', label: '시간과 날씨: 낮, 맑음' });
    expect(skyButton('dusk', 'snow')).toEqual({ icon: '🌇', badge: '❄️', label: '시간과 날씨: 저녁, 눈' });
    expect(skyButton('night', 'rain')).toMatchObject({ icon: '🌙', badge: '💧' });
  });

  it('선택 창: 시간 3개와 날씨 3개, 지금 것에 표시', () => {
    const o = skyOptions('night', 'rain');
    expect(o.times.map((t) => [t.id, t.label, t.selected])).toEqual([
      ['day', '낮', false],
      ['dusk', '저녁', false],
      ['night', '밤', true],
    ]);
    expect(o.weathers.map((w) => [w.id, w.label, w.selected])).toEqual([
      ['clear', '맑음', false],
      ['rain', '비', true],
      ['snow', '눈', false],
    ]);
    expect(o.times.every((t) => t.icon.length > 0)).toBe(true);
    expect(o.weathers.every((w) => w.icon.length > 0)).toBe(true);
  });
});
