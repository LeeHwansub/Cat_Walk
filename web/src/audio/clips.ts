import type { Rng } from '../core/rng';

/** 울음 상황. 상황에 맞는 파일을 골라 재생한다. */
export type MeowMood = 'normal' | 'curious' | 'hungry';

export interface ClipDef {
  id: string;
  file: string;
  mood: MeowMood;
  /** 새끼 고양이 울음 */
  kitten: boolean;
}

/** 사용자가 제공한 소리 파일 (docs/ASSETS.md) */
export const MEOW_CLIPS: ClipDef[] = [
  { id: 'meow-1', file: 'meow-1.mp3', mood: 'normal', kitten: false },
  { id: 'meow-2', file: 'meow-2.mp3', mood: 'normal', kitten: false },
  { id: 'meow-3', file: 'meow-3.mp3', mood: 'normal', kitten: false },
  { id: 'meow-curious', file: 'meow-curious.mp3', mood: 'curious', kitten: false },
  { id: 'meow-hungry', file: 'meow-hungry.mp3', mood: 'hungry', kitten: false },
  { id: 'kitten-meow-1', file: 'kitten-meow-1.mp3', mood: 'normal', kitten: true },
];

/** 골골송: 사용자 제공 휴대폰 녹음 (docs/ASSETS.md). 두 파일을 번갈아 쓴다. */
export const PURR_FILES = ['purr-1.m4a', 'purr-2.m4a'];

/** 골골송은 아주 작게 녹음되어 증폭 상한을 따로 둔다 (잡음은 재생 시 저역 통과 필터로 줄인다) */
export const PURR_MAX_GAIN = 10;

/** 새끼 고양이가 성체 울음 파일을 쓸 때 높이는 재생 속도 (음도 함께 높아진다) */
export const KITTEN_RATE = 1.25;

/**
 * 재생할 울음 파일을 고른다.
 * - 직전 파일은 다른 후보가 있으면 피한다 (같은 소리 연속 재생 방지, 기획서 10.2)
 * - 상황 파일이 없거나 직전에 썼으면 일반 울음으로 대신한다
 * - 새끼 고양이는 새끼 울음 파일 또는 성체 울음을 높은 음으로 재생한다
 */
export function pickMeowClip(
  clips: readonly ClipDef[],
  mood: MeowMood,
  kitten: boolean,
  lastId: string | null,
  rng: Rng,
): { clip: ClipDef; rate: number } | null {
  const adult = clips.filter((c) => !c.kitten);
  const pool = (m: MeowMood) => {
    const own = adult.filter((c) => c.mood === m);
    return kitten ? [...clips.filter((c) => c.kitten), ...own] : own;
  };
  let candidates = pool(mood).filter((c) => c.id !== lastId);
  if (candidates.length === 0 && mood !== 'normal') candidates = pool('normal').filter((c) => c.id !== lastId);
  if (candidates.length === 0) candidates = clips.filter((c) => c.id !== lastId && (kitten || !c.kitten));
  if (candidates.length === 0) return null;
  const clip = candidates[Math.floor(rng() * candidates.length) % candidates.length];
  return { clip, rate: kitten && !clip.kitten ? KITTEN_RATE : 1 };
}

/** 증폭 상한. 너무 작은 파일을 과하게 키우면 배경 잡음까지 커진다. */
export const MAX_GAIN = 6;

/**
 * 파일 앞쪽 무음을 건너뛸 시작 위치(초)와, 최대 음량을 맞추기 위한 배율을 계산한다.
 * 원본 파일은 수정하지 않고 재생할 때만 적용한다.
 * 무음 기준은 파일의 최대 음량에 비례한다 (아주 작은 파일도 소리 시작점을 찾도록).
 */
export function analyzeClip(
  samples: Float32Array,
  sampleRate: number,
  { threshold = 0.02, targetPeak = 0.8, maxGain = MAX_GAIN }: { threshold?: number; targetPeak?: number; maxGain?: number } = {},
): { start: number; gain: number } {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 1e-4) return { start: 0, gain: 1 };
  const onset = Math.min(threshold, peak * 0.25);
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]) <= onset) first++;
  const lead = Math.round(sampleRate * 0.03); // 소리 시작 직전 30ms는 남긴다
  const start = Math.max(0, first - lead) / sampleRate;
  return { start, gain: Math.min(maxGain, targetPeak / peak) };
}
