import { TIMES, TIME_LABEL, type TimeOfDay } from '../world/lighting';
import { WEATHERS, WEATHER_LABEL, type Weather } from '../world/weather';

/**
 * 시간·날씨 아이콘 (오른쪽 위, 사용자 요청 2026-11-16): 무엇을 보여 줄지만 정한다 (화면은 skyMenuView.ts)
 */
export const TIME_ICON: Record<TimeOfDay, string> = { day: '☀️', dusk: '🌇', night: '🌙' };
export const WEATHER_ICON: Record<Weather, string> = { clear: '🌤️', rain: '💧', snow: '❄️' };

/** 아이콘 버튼: 지금 시간대 그림, 비·눈이면 작은 표시, 화면 읽기용 이름 */
export function skyButton(t: TimeOfDay, w: Weather): { icon: string; badge: string; label: string } {
  return { icon: TIME_ICON[t], badge: w === 'clear' ? '' : WEATHER_ICON[w], label: `시간과 날씨: ${TIME_LABEL[t]}, ${WEATHER_LABEL[w]}` };
}

export interface SkyOption<T> {
  id: T;
  label: string;
  icon: string;
  selected: boolean;
}

/** 선택 창의 시간 3개, 날씨 3개 */
export function skyOptions(t: TimeOfDay, w: Weather): { times: SkyOption<TimeOfDay>[]; weathers: SkyOption<Weather>[] } {
  return {
    times: TIMES.map((id) => ({ id, label: TIME_LABEL[id], icon: TIME_ICON[id], selected: id === t })),
    weathers: WEATHERS.map((id) => ({ id, label: WEATHER_LABEL[id], icon: WEATHER_ICON[id], selected: id === w })),
  };
}
