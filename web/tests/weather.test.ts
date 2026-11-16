import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHTING, resolveLighting } from '../src/world/lighting';
import { isWeather, WEATHERS, WEATHER_LABEL, weatherLighting } from '../src/world/weather';
import { mapById, MAPS } from '../src/world/maps';
import { defaultSave, loadSave, SAVE_KEY, writeSave, type KeyValueStore } from '../src/save/storage';

function mem(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

/** #rrggbb의 채도 (0 = 회색) */
const sat = (hex: string) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...v) - Math.min(...v);
};

describe('날씨 (맑음·비·눈, 사용자 요청 2026-11-16)', () => {
  it('맑음 → 비 → 눈 세 가지, 이름이 있다', () => {
    expect(WEATHERS).toEqual(['clear', 'rain', 'snow']);
    expect(WEATHER_LABEL).toEqual({ clear: '맑음', rain: '비', snow: '눈' });
    expect(isWeather('rain')).toBe(true);
    expect(isWeather('fog')).toBe(false);
  });

  it('맵의 기본 날씨: 눈 오는 광장은 눈, 나머지는 맑음', () => {
    expect(mapById('xmas').defaultWeather).toBe('snow');
    for (const m of MAPS.filter((m) => m.id !== 'xmas')) expect(m.defaultWeather ?? 'clear').toBe('clear');
  });

  it('맵의 기본 날씨이거나 맑음이면 조명을 그대로 쓴다 (눈 오는 광장의 눈은 보드 색값 그대로)', () => {
    const xmasDusk = resolveLighting(mapById('xmas'), 'dusk');
    expect(weatherLighting(xmasDusk, 'snow', 'snow')).toBe(xmasDusk);
    expect(weatherLighting(xmasDusk, 'clear', 'snow')).toBe(xmasDusk);
    expect(weatherLighting(DEFAULT_LIGHTING.day, 'clear', 'clear')).toBe(DEFAULT_LIGHTING.day);
  });

  it('비: 하늘·안개가 잿빛으로, 햇빛이 약하게, 안개가 가깝게. 원래 조명은 바꾸지 않는다', () => {
    const day = DEFAULT_LIGHTING.day;
    const before = JSON.stringify(day);
    const rain = weatherLighting(day, 'rain', 'clear');
    expect(rain).not.toBe(day);
    rain.sky.forEach((c, i) => expect(sat(c)).toBeLessThan(sat(day.sky[i])));
    expect(sat(rain.fog.color)).toBeLessThan(sat(day.fog.color));
    expect(rain.sun.intensity).toBeLessThan(day.sun.intensity * 0.5);
    expect(rain.hemi[2]).toBeLessThan(day.hemi[2]);
    expect(rain.fog.far).toBeLessThan(day.fog.far);
    expect(rain.fog.near).toBeLessThan(day.fog.near);
    expect(rain.lamps).toBe(day.lamps); // 불빛은 그대로
    expect(JSON.stringify(day)).toBe(before);
  });

  it('밤에 비가 와도 하늘이 밝아지지 않는다', () => {
    const night = DEFAULT_LIGHTING.night;
    const lum = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
    weatherLighting(night, 'rain', 'clear').sky.forEach((c, i) => expect(lum(c)).toBeLessThanOrEqual(lum(night.sky[i])));
  });

  it('다른 맵의 눈: 비보다는 밝고 햇빛이 조금 약해진다', () => {
    const day = DEFAULT_LIGHTING.day;
    const snow = weatherLighting(day, 'snow', 'clear');
    const rain = weatherLighting(day, 'rain', 'clear');
    expect(snow.sun.intensity).toBeLessThan(day.sun.intensity);
    expect(snow.sun.intensity).toBeGreaterThan(rain.sun.intensity);
  });

  it('맵마다 고른 날씨를 저장하고, 잘못된 값은 버린다', () => {
    const store = mem();
    const save = defaultSave();
    expect(save.weatherByMap).toEqual({});
    save.weatherByMap = { neighborhood: 'rain', xmas: 'clear' };
    writeSave(store, save);
    expect(loadSave(store)!.weatherByMap).toEqual({ neighborhood: 'rain', xmas: 'clear' });
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), weatherByMap: { a: 'fog', b: 'snow', ['x'.repeat(50)]: 'rain' } }));
    expect(loadSave(store)!.weatherByMap).toEqual({ b: 'snow' });
    const old: Record<string, unknown> = { ...defaultSave() };
    delete old.weatherByMap;
    store.setItem(SAVE_KEY, JSON.stringify(old));
    expect(loadSave(store)!.weatherByMap).toEqual({}); // 예전 저장
  });
});
