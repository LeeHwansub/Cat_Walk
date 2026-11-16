import type { Rng } from '../core/rng';
import type { TimeOfDay } from '../world/lighting';
import type { Weather } from '../world/weather';

/**
 * 빗소리 수치 (날씨 비, 사용자 선택 2026-11-16: 파일 대신 코드로 합성). 소리를 만드는 것은 AudioManager.
 * 쏴아(고음을 살린 잡음) + 웅웅(낮은 잡음) 바탕에 가끔 톡톡 떨어지는 빗방울을 얹는다
 */
export const RAIN_SOUND = {
  /** 바탕 소리 크기 (바람 0.035) */
  bed: 0.12,
  /** 켜고 끌 때 시간 상수 (초): 3배에 95% */
  fade: 0.35,
  hiss: { highpass: 500, lowpass: 5500, gain: 1 },
  rumble: { lowpass: 900, gain: 0.6 },
  /** 빗방울 한 번 크기 (최대) */
  drop: 0.09,
  /** 빗방울 음 높이 범위 (Hz) */
  dropFreq: [2200, 5200] as const,
};

/** 새소리는 맑은 날 낮에만 (사용자 요청 2026-11-16: 저녁·밤·비·눈에는 굳이 필요 없다) */
export function birdsSing(t: TimeOfDay, w: Weather): boolean {
  return t === 'day' && w === 'clear';
}

/** 다음 빗방울까지 (초): 0.04 ~ 0.2 */
export function dropInterval(rng: Rng): number {
  return 0.04 + rng() * 0.16;
}
