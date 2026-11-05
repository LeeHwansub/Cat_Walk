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

/**
 * 골골송은 아주 작게 녹음되어(평균 -48~-54 LUFS) 증폭 상한을 따로 둔다.
 * 순간적으로 튀는 소리 때문에 최대 음량 제한 대신 재생 시 리미터를 쓰고, 고음 잡음은 저역 통과 필터로 줄인다.
 */
export const PURR_MAX_GAIN = 100;

/** 골골송 재생 시 고음 잡음을 줄이는 저역 통과 필터 (측정에도 같은 값을 쓴다) */
export const PURR_LOWPASS_HZ = 1800;

/** 새끼 고양이가 성체 울음 파일을 쓸 때 높이는 재생 속도 (음도 함께 높아진다) */
export const KITTEN_RATE = 1.25;

/**
 * 크기 조절 값에 따른 울음 음높이 배율. 작을수록 약간 높고, 클수록 약간 낮다.
 * (80% → 약 1.09배, 120% → 약 0.93배)
 */
export function sizePitch(size: number): number {
  if (!(size > 0) || size === 1) return 1;
  return Math.pow(1 / size, 0.4);
}

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

/** 모든 고양이 소리를 맞출 목표 크기 (LUFS, 사람이 느끼는 크기 기준) */
export const TARGET_LUFS = -16;

/** 최대 음량 제한 (클리핑 방지) */
export const PEAK_LIMIT = 0.95;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function normalize(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** RBJ 오디오 EQ 공식 */
function highShelf(fs: number, fc: number, q: number, gainDb: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const sq = 2 * Math.sqrt(A) * alpha;
  return normalize(
    A * (A + 1 + (A - 1) * cos + sq),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - sq),
    A + 1 - (A - 1) * cos + sq,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - sq,
  );
}

function highPass(fs: number, fc: number, q: number): Biquad {
  const w = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  return normalize((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

function lowPass(fs: number, fc: number, q: number): Biquad {
  const w = (2 * Math.PI * fc) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  return normalize((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

function filter(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/**
 * 통합 음량(LUFS) 측정 — ITU-R BS.1770 방식.
 * K-가중 필터(사람 귀의 감도 반영) → 400ms 구간(100ms 간격) → 절대 게이트(-70 LUFS)와 상대 게이트(-10 LU)로 무음 구간 제외.
 * lowpassHz를 주면 재생할 때 거는 저역 통과 필터를 먼저 적용하고 측정한다.
 * 측정할 소리가 없으면 -Infinity.
 */
export function measureLufs(channels: Float32Array | Float32Array[], sampleRate: number, lowpassHz?: number): number {
  const list = Array.isArray(channels) ? channels : [channels];
  // 채널마다 K-가중 필터를 거친 뒤, 구간 음량은 채널 음량의 합으로 계산한다 (BS.1770, 좌우 가중치 1)
  const xs = list.map((c) => {
    let x = c;
    if (lowpassHz) x = filter(x, lowPass(sampleRate, lowpassHz, Math.SQRT1_2));
    x = filter(x, highShelf(sampleRate, 1681.974450955533, 0.7071752369554196, 3.999843853973347));
    return filter(x, highPass(sampleRate, 38.13547087602444, 0.5003270373238773));
  });
  const length = Math.min(...xs.map((x) => x.length));

  const block = Math.round(sampleRate * 0.4);
  const step = Math.round(sampleRate * 0.1);
  const powers: number[] = [];
  const push = (from: number, to: number) => {
    let sum = 0;
    for (const x of xs) for (let i = from; i < to; i++) sum += x[i] * x[i];
    powers.push(sum / (to - from));
  };
  if (length < block) {
    if (length > 0) push(0, length);
  } else {
    for (let i = 0; i + block <= length; i += step) push(i, i + block);
  }
  const lufs = (z: number) => -0.691 + 10 * Math.log10(z);
  const abs = powers.filter((z) => z > 0 && lufs(z) > -70);
  if (abs.length === 0) return -Infinity;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const relGate = lufs(mean(abs)) - 10;
  const gated = abs.filter((z) => lufs(z) > relGate);
  return lufs(mean(gated));
}

/**
 * 파일 앞쪽 무음을 건너뛸 시작 위치(초)와, 소리 크기를 맞추기 위한 배율을 계산한다.
 * 원본 파일은 수정하지 않고 재생할 때만 적용한다.
 *
 * 크기 기준은 LUFS(사람이 느끼는 크기)다. 모든 소리를 TARGET_LUFS로 맞춘다.
 * - peakLimit: 키운 뒤 최대 음량이 이 값을 넘지 않게 배율을 제한한다. null이면 제한하지 않는다
 *   (순간적으로 튀는 소리가 많은 녹음은 재생 시 리미터로 처리하고 목표 크기까지 키운다).
 * - lowpassHz: 재생할 때 저역 통과 필터를 거는 소리는 같은 필터를 거친 크기로 측정한다.
 */
export function analyzeClip(
  channels: Float32Array | Float32Array[],
  sampleRate: number,
  {
    threshold = 0.02,
    targetLufs = TARGET_LUFS,
    peakLimit = PEAK_LIMIT,
    maxGain = MAX_GAIN,
    lowpassHz,
  }: { threshold?: number; targetLufs?: number; peakLimit?: number | null; maxGain?: number; lowpassHz?: number } = {},
): { start: number; gain: number } {
  const list = Array.isArray(channels) ? channels : [channels];
  let peak = 0;
  for (const c of list) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  if (peak < 1e-4) return { start: 0, gain: 1 };

  // 소리 시작점: 무음 기준은 최대 음량에 비례 (아주 작은 파일도 찾도록). 여러 채널 중 가장 이른 곳
  const onset = Math.min(threshold, peak * 0.25);
  let first = Infinity;
  for (const c of list) {
    let i = 0;
    while (i < c.length && Math.abs(c[i]) <= onset) i++;
    first = Math.min(first, i);
  }
  const lead = Math.round(sampleRate * 0.03); // 소리 시작 직전 30ms는 남긴다
  const start = Math.max(0, first - lead) / sampleRate;

  const loudness = measureLufs(list, sampleRate, lowpassHz);
  if (!Number.isFinite(loudness)) return { start, gain: 1 };
  let gain = Math.pow(10, (targetLufs - loudness) / 20);
  if (peakLimit !== null) gain = Math.min(gain, peakLimit / peak);
  return { start, gain: Math.min(maxGain, gain) };
}
