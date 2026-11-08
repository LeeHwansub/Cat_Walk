import { describe, expect, it } from 'vitest';
import { defaultAppearance, isEarType, isPattern, PRESETS } from '../src/cat/appearance';
import { defaultSave, loadSave, SAVE_KEY, type KeyValueStore } from '../src/save/storage';

describe('프리셋', () => {
  it('뽀리·레오는 없고 기본 프리셋 5개가 남아 있다 (2026-11-09 사용자 요청)', () => {
    expect(PRESETS.map((p) => p.label)).toEqual(['치즈냥', '고등어', '턱시도', '삼색이', '흰냥이']);
  });

  it('처음 시작할 때의 기본 고양이는 그대로(치즈냥, 선 귀)', () => {
    const d = defaultAppearance();
    expect(d.pattern).toBe('cheese');
    expect(d.ear).toBe('up');
  });

  it('뽀리·레오가 쓰던 무늬·귀는 꾸미기 선택지에 남아 있다', () => {
    expect(isPattern('tabbyWhite')).toBe(true);
    expect(isEarType('fold')).toBe(true);
    expect(isEarType('down')).toBe(false);
  });
});

describe('저장 — 귀 형태, 목걸이 제거', () => {
  function mem(): KeyValueStore {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('이전 저장(귀 값 없음)을 불러오면 선 귀', () => {
    const store = mem();
    const { ear: _e, ...old } = defaultSave().cat;
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: old }));
    expect(loadSave(store)!.cat.ear).toBe('up');
  });

  it('목걸이가 있던 이전 저장도 불러오고, 목걸이 값은 버린다', () => {
    const store = mem();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: { ...defaultSave().cat, accessory: 'heartTag' } }));
    const c = loadSave(store)!.cat;
    expect(c).toBeTruthy();
    expect('accessory' in c).toBe(false);
  });

  it('잘못된 귀 값은 기본값으로', () => {
    const store = mem();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: { ...defaultSave().cat, ear: 'x' } }));
    expect(loadSave(store)!.cat.ear).toBe('up');
  });
});
