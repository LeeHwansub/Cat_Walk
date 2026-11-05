import { describe, expect, it } from 'vitest';
import { analyzeClip, MAX_GAIN, MEOW_CLIPS, pickMeowClip } from '../src/audio/clips';
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
  const rate = 1000;
  function signal(silentSamples: number, peak: number, length = 2000): Float32Array {
    const a = new Float32Array(length);
    for (let i = silentSamples; i < length; i++) a[i] = Math.sin(i) * peak;
    return a;
  }

  it('앞쪽 무음을 건너뛸 시작 위치를 찾는다 (약간의 여유를 둔다)', () => {
    const r = analyzeClip(signal(700, 0.5), rate);
    expect(r.start).toBeGreaterThan(0.6);
    expect(r.start).toBeLessThanOrEqual(0.7);
  });

  it('무음이 없으면 처음부터 재생한다', () => {
    expect(analyzeClip(signal(0, 0.5), rate).start).toBe(0);
  });

  it('작은 소리는 키우고 큰 소리는 줄여 최대 음량을 맞춘다 (상한 이내)', () => {
    const quiet = analyzeClip(signal(0, 0.2), rate);
    const loud = analyzeClip(signal(0, 0.9), rate);
    expect(quiet.gain).toBeGreaterThan(1);
    expect(loud.gain).toBeLessThan(1);
    expect(0.2 * quiet.gain).toBeCloseTo(0.9 * loud.gain, 1);
  });

  it('증폭은 상한을 넘지 않는다', () => {
    expect(analyzeClip(signal(0, 0.01), rate).gain).toBe(MAX_GAIN);
  });

  it('상한을 따로 지정할 수 있다 (작게 녹음된 골골송용)', () => {
    expect(analyzeClip(signal(0, 0.08), rate, { maxGain: 10 }).gain).toBeCloseTo(10, 5);
    expect(analyzeClip(signal(0, 0.01), rate, { maxGain: 10 }).gain).toBe(10);
  });

  it('완전 무음이면 증폭하지 않는다', () => {
    const r = analyzeClip(new Float32Array(1000), rate);
    expect(r.gain).toBe(1);
    expect(r.start).toBe(0);
  });
});
