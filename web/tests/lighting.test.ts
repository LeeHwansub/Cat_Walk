import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHTING, isTimeOfDay, nextTime, resolveLighting, TIMES, TIME_LABEL } from '../src/world/lighting';
import { mapById } from '../src/world/maps';
import { defaultSave, loadSave, SAVE_KEY, writeSave, type KeyValueStore } from '../src/save/storage';

function mem(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('시간대 (모든 맵, 사용자 요청 2026-11-16)', () => {
  it('낮 → 저녁 → 밤 → 낮으로 돌아가며 바뀐다', () => {
    expect(TIMES).toEqual(['day', 'dusk', 'night']);
    expect(nextTime('day')).toBe('dusk');
    expect(nextTime('dusk')).toBe('night');
    expect(nextTime('night')).toBe('day');
    expect(TIME_LABEL).toEqual({ day: '낮', dusk: '저녁', night: '밤' });
    expect(isTimeOfDay('dusk')).toBe(true);
    expect(isTimeOfDay('noon')).toBe(false);
  });

  it('맵에 자기 조명이 없으면 공통 조명을 쓰고, 기본 시간대는 낮', () => {
    const def = mapById('neighborhood');
    expect(def.defaultTime ?? 'day').toBe('day');
    for (const t of TIMES) expect(resolveLighting(def, t)).toBe(DEFAULT_LIGHTING[t]);
  });

  it('공통 낮은 지금까지의 오후 햇빛 그대로 (다른 맵 모습이 바뀌지 않게)', () => {
    const d = DEFAULT_LIGHTING.day;
    expect(d.fog.color).toBe('#cfe2ee');
    expect(d.sun.color).toBe('#fff0d8');
    expect(d.sun.intensity).toBe(2.7);
    expect(d.hemi).toEqual(['#e2eef7', '#8a7d6c', 1.15]);
    expect(d.lamps).toBe(0); // 낮에는 불빛을 켜지 않는다
  });

  it('밤은 불빛이 주인공: 불빛이 가장 세고 고양이 보조광이 켜진다', () => {
    const { day, dusk, night } = DEFAULT_LIGHTING;
    expect(night.lamps).toBeGreaterThan(dusk.lamps);
    expect(dusk.lamps).toBeGreaterThan(day.lamps);
    expect(night.fill).toBeGreaterThan(0);
    expect(night.hemi[2]).toBeLessThan(day.hemi[2]);
  });

  it('눈 오는 광장은 보드(X-02) 색값을 쓰고 기본은 저녁', () => {
    const x = mapById('xmas');
    expect(x.defaultTime).toBe('dusk');
    const dusk = resolveLighting(x, 'dusk');
    expect(dusk.sky).toEqual(['#27356b', '#6a5a93', '#f0a070']);
    expect(dusk.hemi).toEqual(['#93a5e0', '#5b5578', 0.85]);
    expect(dusk.fog).toEqual({ color: '#8f86a8', near: 26, far: 78 });
    expect(resolveLighting(x, 'night').sky).toEqual(['#070b22', '#27305c']);
    expect(resolveLighting(x, 'day').sky).toEqual(['#8fbbe8', '#eef3f8']);
  });

  it('맵마다 고른 시간대를 저장하고, 잘못된 값은 버린다', () => {
    const store = mem();
    const save = defaultSave();
    expect(save.timeByMap).toEqual({});
    save.timeByMap = { neighborhood: 'night', xmas: 'day' };
    writeSave(store, save);
    expect(loadSave(store)!.timeByMap).toEqual({ neighborhood: 'night', xmas: 'day' });
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), timeByMap: { a: 'noon', b: 'dusk', ['x'.repeat(50)]: 'day' } }));
    expect(loadSave(store)!.timeByMap).toEqual({ b: 'dusk' });
    const old: Record<string, unknown> = { ...defaultSave() };
    delete old.timeByMap;
    store.setItem(SAVE_KEY, JSON.stringify(old));
    expect(loadSave(store)!.timeByMap).toEqual({}); // 예전 저장
  });
});
