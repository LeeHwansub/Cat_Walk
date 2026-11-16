/**
 * 시간대와 조명 묶음 (사용자 요청 2026-11-16: 모든 맵에서 낮·저녁·밤을 바꾼다. 크리스마스 보드 X-02의 시간대 전환을 모든 맵으로).
 * 맵은 자기 조명 묶음을 가질 수 있고(눈 오는 광장), 없으면 공통 묶음을 쓴다. 공통 낮은 지금까지의 오후 햇빛 그대로다.
 */

export type TimeOfDay = 'day' | 'dusk' | 'night';
export const TIMES: readonly TimeOfDay[] = ['day', 'dusk', 'night'];
export const TIME_LABEL: Record<TimeOfDay, string> = { day: '낮', dusk: '저녁', night: '밤' };

export function isTimeOfDay(v: unknown): v is TimeOfDay {
  return v === 'day' || v === 'dusk' || v === 'night';
}

/** 낮 → 저녁 → 밤 → 낮 */
export function nextTime(t: TimeOfDay): TimeOfDay {
  return TIMES[(TIMES.indexOf(t) + 1) % TIMES.length];
}

export interface Lighting {
  /** 하늘 그라데이션: 꼭대기 → … → 지평선 */
  sky: string[];
  /** 반구광: 하늘 색, 땅 색, 세기 */
  hemi: [string, string, number];
  /** 해(밤에는 달): 색, 세기, 고양이 기준 위치 (그림자 방향) */
  sun: { color: string; intensity: number; offset: [number, number, number] };
  fog: { color: string; near: number; far: number };
  exposure: number;
  /** 빛나는 재질(전구·창문·불꽃) 밝기. 1 = 그대로, 낮에는 꺼진 듯 약하게 */
  glow: number;
  /** 맵의 불빛(점조명·빛 번짐) 세기. 0 = 끔 */
  lamps: number;
  /** 어두울 때 고양이 주변 보조광 세기. 0 = 끔 */
  fill: number;
}

/** 공통 조명 (맵이 자기 묶음을 갖지 않을 때) */
export const DEFAULT_LIGHTING: Record<TimeOfDay, Lighting> = {
  // 지금까지의 오후 햇빛 (scene.ts의 원래 값)
  day: {
    sky: ['#a9cbe6', '#cfe2ee'],
    hemi: ['#e2eef7', '#8a7d6c', 1.15],
    sun: { color: '#fff0d8', intensity: 2.7, offset: [9, 15, 6] },
    fog: { color: '#cfe2ee', near: 30, far: 95 },
    exposure: 1.05,
    glow: 0.55,
    lamps: 0,
    fill: 0,
  },
  dusk: {
    sky: ['#2c3a72', '#6a5a93', '#f0a070'],
    hemi: ['#a7b4e0', '#6b5a55', 0.8],
    sun: { color: '#ffa56b', intensity: 1.3, offset: [-14, 5, 4] },
    fog: { color: '#9a88a6', near: 28, far: 90 },
    exposure: 1.0,
    glow: 1,
    lamps: 1,
    fill: 0.25,
  },
  night: {
    sky: ['#070b22', '#27305c'],
    hemi: ['#5b72c4', '#20244a', 0.42],
    sun: { color: '#9fb4ff', intensity: 0.45, offset: [-6, 14, -8] },
    fog: { color: '#1a2248', near: 26, far: 85 },
    exposure: 1.0,
    glow: 1.25,
    lamps: 1.5,
    fill: 0.6,
  },
};

/** 맵 정의 중 조명에 쓰는 부분 */
export interface LitMap {
  lighting?: Partial<Record<TimeOfDay, Lighting>>;
  defaultTime?: TimeOfDay;
}

export function resolveLighting(def: LitMap, t: TimeOfDay): Lighting {
  return def.lighting?.[t] ?? DEFAULT_LIGHTING[t];
}

/** 맵의 불빛 자리 (가로등 머리, 창문, 화로 …). 저녁·밤에 빛 번짐을 띄우고, 앞의 8개까지는 실제 점조명을 켠다 */
export interface MapLight {
  x: number;
  y: number;
  z: number;
  /** 불빛 색 (기본 따뜻한 노랑) */
  color?: string;
  /** 빛 번짐 크기 (m, 기본 1.4) */
  halo?: number;
  /** false면 빛 번짐만 (점조명을 쓰지 않는다) */
  light?: boolean;
}
