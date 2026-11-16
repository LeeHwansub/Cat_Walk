import type { Lighting } from './lighting';

/**
 * 날씨 (사용자 요청 2026-11-16: 오른쪽 위 아이콘에서 시간대와 함께 고른다). 맵마다 저장한다.
 * 입자(빗줄기·눈송이)는 precipitation.ts, 여기서는 종류와 조명 조정만.
 */
export type Weather = 'clear' | 'rain' | 'snow';
export const WEATHERS: readonly Weather[] = ['clear', 'rain', 'snow'];
export const WEATHER_LABEL: Record<Weather, string> = { clear: '맑음', rain: '비', snow: '눈' };

export function isWeather(v: unknown): v is Weather {
  return v === 'clear' || v === 'rain' || v === 'snow';
}

/** 맵 정의 중 날씨에 쓰는 부분. 없으면 맑음 */
export interface WeatherMap {
  defaultWeather?: Weather;
}

/** 날씨마다 조명을 얼마나 바꾸는가 */
interface Shift {
  /** 하늘·안개 색을 잿빛으로 (0 = 그대로, 1 = 완전 회색) */
  gray: number;
  /** 하늘·안개 색을 어둡게 (1 = 그대로) */
  dark: number;
  sun: number;
  hemi: number;
  fogNear: number;
  fogFar: number;
}

const SHIFT: Record<Exclude<Weather, 'clear'>, Shift> = {
  rain: { gray: 0.65, dark: 0.8, sun: 0.15, hemi: 0.9, fogNear: 0.45, fogFar: 0.6 },
  snow: { gray: 0.35, dark: 0.95, sun: 0.55, hemi: 0.95, fogNear: 0.6, fogFar: 0.75 },
};

/**
 * 시간대 조명에 날씨를 얹는다. 맵의 기본 날씨(눈 오는 광장의 눈)는 이미 그 맵 조명에 들어 있으므로 그대로 쓰고,
 * 맑음도 그대로다. 그 밖에는 하늘을 흐리게, 햇빛을 약하게, 안개를 가깝게 한다. 불빛(lamps·glow)은 그대로.
 * 받은 조명은 바꾸지 않고 새로 만든다
 */
export function weatherLighting(l: Lighting, w: Weather, base: Weather): Lighting {
  if (w === 'clear' || w === base) return l;
  const s = SHIFT[w];
  const tint = (hex: string) => overcast(hex, s.gray, s.dark);
  return {
    ...l,
    sky: l.sky.map(tint),
    hemi: [tint(l.hemi[0]), l.hemi[1], l.hemi[2] * s.hemi],
    sun: { ...l.sun, intensity: l.sun.intensity * s.sun },
    fog: { color: tint(l.fog.color), near: l.fog.near * s.fogNear, far: l.fog.far * s.fogFar },
  };
}

/** #rrggbb를 같은 밝기의 회색 쪽으로 gray만큼 섞고 dark를 곱한다. 회색으로 섞어도 밝아지지 않는다 */
function overcast(hex: string, gray: number, dark: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return (
    '#' +
    c
      .map((v) => {
        const mixed = v + (lum - v) * gray;
        return Math.round(Math.max(0, Math.min(255, mixed * dark)))
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}
