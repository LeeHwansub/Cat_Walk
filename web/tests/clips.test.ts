import { describe, expect, it } from 'vitest';
import { analyzeClip, MAX_GAIN, measureLufs, MEOW_CLIPS, PEAK_LIMIT, pickMeowClip, TARGET_LUFS } from '../src/audio/clips';
import { createRng } from '../src/core/rng';

describe('pickMeowClip', () => {
  it('직전에 재생한 파일은 다른 후보가 있으면 다시 고르지 않는다', () => {
    const rng = createRng(1);
    let last: string | null = null;
    for (let i = 0; i < 200; i++) {
      const p: { clip: { id: string } } = pickMeowClip(MEOW_CLIPS, 'normal', false, last, rng)!;
      expect(p.clip.id).not.toBe(last);
      last = p.clip.id;
    }
  });

  it('상황(mood)에 맞는 파일을 고른다', () => {
    const p = pickMeowClip(MEOW_CLIPS, 'hungry', false, null, createRng(2))!;
    expect(p.clip.mood).toBe('hungry');
    const c = pickMeowClip(MEOW_CLIPS, 'curious', false, null, createRng(2))!;
    expect(c.clip.mood).toBe('curious');
  });

  it('같은 상황 파일이 직전에 재생됐으면 일반 울음으로 대신한다', () => {
    const hungryId = MEOW_CLIPS.find((c) => c.mood === 'hungry' && !c.kitten)!.id;
    const p = pickMeowClip(MEOW_CLIPS, 'hungry', false, hungryId, createRng(3))!;
    expect(p.clip.id).not.toBe(hungryId);
    expect(p.clip.mood).toBe('normal');
  });

  it('성체 고양이는 새끼 울음을 쓰지 않고 원래 속도로 재생한다', () => {
    const rng = createRng(4);
    for (let i = 0; i < 100; i++) {
      const p = pickMeowClip(MEOW_CLIPS, 'normal', false, null, rng)!;
      expect(p.clip.kitten).toBe(false);
      expect(p.rate).toBe(1);
    }
  });

  it('새끼 고양이는 새끼 울음을 쓰거나 성체 울음을 높은 음으로 재생한다', () => {
    const rng = createRng(5);
    let kittenClip = 0;
    for (let i = 0; i < 200; i++) {
      const p = pickMeowClip(MEOW_CLIPS, 'normal', true, null, rng)!;
      if (p.clip.kitten) {
        kittenClip++;
        expect(p.rate).toBe(1);
      } else {
        expect(p.rate).toBeGreaterThan(1);
      }
    }
    expect(kittenClip).toBeGreaterThan(0);
  });

  it('후보가 없으면 null', () => {
    expect(pickMeowClip([], 'normal', false, null, createRng(6))).toBeNull();
  });
});

describe('analyzeClip', () => {
  const RATE = 48000;
  /** silent초 무음 뒤에 seconds초 동안 freq Hz 사인파 */
  function tone(amp: number, { silent = 0, seconds = 2, freq = 997 } = {}): Float32Array {
    const a = new Float32Array(Math.round((silent + seconds) * RATE));
    const s0 = Math.round(silent * RATE);
    for (let i = s0; i < a.length; i++) a[i] = Math.sin((2 * Math.PI * freq * (i - s0)) / RATE) * amp;
    return a;
  }

  it('앞쪽 무음을 건너뛸 시작 위치를 찾는다 (30ms 여유)', () => {
    const r = analyzeClip(tone(0.5, { silent: 0.7 }), RATE);
    expect(r.start).toBeGreaterThan(0.6);
    expect(r.start).toBeLessThanOrEqual(0.7);
  });

  it('무음이 없으면 처음부터 재생한다', () => {
    expect(analyzeClip(tone(0.5), RATE).start).toBe(0);
  });

  it('LUFS 측정: 1kHz 사인파는 표준값(진폭 0.5 → 약 -9 LUFS)과 맞는다', () => {
    expect(measureLufs(tone(0.5), RATE)).toBeCloseTo(-9.03, 0);
  });

  it('사람 귀에 잘 안 들리는 아주 낮은 소리(골골송 기본음 25Hz)는 같은 진폭이어도 작게 측정된다', () => {
    expect(measureLufs(tone(0.5, { freq: 25 }), RATE)).toBeLessThan(measureLufs(tone(0.5), RATE) - 10);
  });

  it('LUFS 기준으로 맞춘다: 크기가 다른 소리가 같은 크기(목표 LUFS)가 된다', () => {
    for (const amp of [0.05, 0.2, 0.6]) {
      const a = tone(amp);
      const g = analyzeClip(a, RATE, { maxGain: 100 }).gain;
      expect(measureLufs(a.map((v) => v * g), RATE)).toBeCloseTo(TARGET_LUFS, 0);
    }
  });

  it('무음 구간은 크기 계산에서 뺀다 (앞 무음이 길어도 배율 차이는 들리지 않는 0.5dB 이내)', () => {
    // 게이트가 없으면 1.5초 무음 + 2초 소리는 약 2.4dB 작게 측정된다.
    // BS.1770은 무음과 소리가 섞인 경계 구간을 일부 포함하므로 아주 작은 차이는 남는다.
    const plain = analyzeClip(tone(0.3), RATE).gain;
    const padded = analyzeClip(tone(0.3, { silent: 1.5 }), RATE).gain;
    expect(Math.abs(20 * Math.log10(padded / plain))).toBeLessThan(0.5);
  });

  it('기본으로는 최대 음량이 넘치지 않게 배율을 제한한다 (클리핑 방지)', () => {
    const a = tone(0.02);
    a[RATE] = 0.9; // 순간적으로 튀는 소리
    const r = analyzeClip(a, RATE, { maxGain: 100 });
    expect(0.9 * r.gain).toBeLessThanOrEqual(PEAK_LIMIT + 1e-6);
  });

  it('최대 음량 제한을 끄면(재생 시 리미터 사용) 목표 크기까지 키운다', () => {
    const a = tone(0.02);
    a[RATE] = 0.9;
    const g = analyzeClip(a, RATE, { peakLimit: null, maxGain: 100 }).gain;
    expect(measureLufs(tone(0.02).map((v) => v * g), RATE)).toBeCloseTo(TARGET_LUFS, 0);
  });

  it('증폭은 상한을 넘지 않는다 (기본 상한, 따로 지정한 상한)', () => {
    expect(analyzeClip(tone(0.001), RATE).gain).toBe(MAX_GAIN);
    expect(analyzeClip(tone(0.001), RATE, { maxGain: 10, peakLimit: null }).gain).toBe(10);
  });

  it('재생할 때 거는 저역 통과 필터를 측정에도 반영한다 (고음이 깎이는 만큼 더 키운다)', () => {
    const a = tone(0.3, { freq: 4000 });
    const plain = analyzeClip(a, RATE, { maxGain: 100 }).gain;
    const lowpassed = analyzeClip(a, RATE, { maxGain: 100, lowpassHz: 1800, peakLimit: null }).gain;
    expect(lowpassed).toBeGreaterThan(plain);
  });

  it('완전 무음이면 증폭하지 않는다', () => {
    const r = analyzeClip(new Float32Array(RATE), RATE);
    expect(r.gain).toBe(1);
    expect(r.start).toBe(0);
  });
});

describe('analyzeClip — 여러 채널', () => {
  const RATE = 48000;
  const tone = (amp: number) => {
    const a = new Float32Array(RATE * 2);
    for (let i = 0; i < a.length; i++) a[i] = Math.sin((2 * Math.PI * 997 * i) / RATE) * amp;
    return a;
  };

  it('스테레오는 두 채널의 음량을 합쳐서 측정한다 (같은 소리 두 채널 = 한 채널보다 3dB 크다)', () => {
    const mono = measureLufs(tone(0.3), RATE);
    const stereo = measureLufs([tone(0.3), tone(0.3)], RATE);
    expect(stereo - mono).toBeCloseTo(3.01, 1);
  });

  it('스테레오 파일도 목표 크기로 맞춘다', () => {
    const ch = [tone(0.3), tone(0.3)];
    const g = analyzeClip(ch, RATE).gain;
    expect(measureLufs(ch.map((c) => c.map((v) => v * g)), RATE)).toBeCloseTo(TARGET_LUFS, 0);
  });
});
