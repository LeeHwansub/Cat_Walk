import { describe, expect, it } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';
import { birdsSing, dropInterval, RAIN_SOUND } from '../src/audio/rain';
import { createRng } from '../src/core/rng';

describe('빗소리 (코드로 합성, 사용자 선택 2026-11-16)', () => {
  it('비가 오면 약 1초에 걸쳐 커지고 그치면 작아진다', () => {
    // setTargetAtTime은 시간 상수의 3배에 95%에 닿는다
    expect(RAIN_SOUND.fade * 3).toBeGreaterThan(0.8);
    expect(RAIN_SOUND.fade * 3).toBeLessThan(1.3);
  });

  it('바람 소리보다 크지만 고양이 소리를 덮지 않는 크기', () => {
    expect(RAIN_SOUND.bed).toBeGreaterThan(0.035); // 바람 0.035
    expect(RAIN_SOUND.bed).toBeLessThan(0.3);
    expect(RAIN_SOUND.drop).toBeLessThan(0.3);
  });

  it('쏴아 소리는 고음을 살린 띠, 웅웅 소리는 낮은 음', () => {
    expect(RAIN_SOUND.hiss.highpass).toBeLessThan(RAIN_SOUND.hiss.lowpass);
    expect(RAIN_SOUND.hiss.highpass).toBeGreaterThanOrEqual(300);
    expect(RAIN_SOUND.rumble.lowpass).toBeLessThan(RAIN_SOUND.hiss.highpass * 3);
  });

  it('빗방울(톡) 간격은 0.04~0.2초 사이에서 무작위', () => {
    const rng = createRng(1);
    const xs = Array.from({ length: 500 }, () => dropInterval(rng));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.04);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.2);
    expect(new Set(xs.map((x) => x.toFixed(3))).size).toBeGreaterThan(50);
  });

  it('소리를 켜기 전(화면을 누르기 전)에도 비 상태를 기억한다', () => {
    const a = new AudioManager();
    expect(a.raining).toBe(false);
    expect(() => a.setRain(true)).not.toThrow();
    expect(a.raining).toBe(true);
    a.setRain(false);
    expect(a.raining).toBe(false);
    expect(() => a.update(0.1)).not.toThrow();
  });

  it('새소리는 맑은 날 낮에만 (사용자 요청 2026-11-16)', () => {
    expect(birdsSing('day', 'clear')).toBe(true);
    for (const t of ['dusk', 'night'] as const) expect(birdsSing(t, 'clear')).toBe(false);
    for (const w of ['rain', 'snow'] as const) expect(birdsSing('day', w)).toBe(false);
  });

  it('소리를 켜기 전에도 새소리 상태를 기억하고, 처음에는 켜져 있다', () => {
    const a = new AudioManager();
    expect(a.birds).toBe(true);
    a.setBirds(false);
    expect(a.birds).toBe(false);
  });
});
