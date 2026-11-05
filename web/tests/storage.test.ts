import { describe, expect, it } from 'vitest';
import { clearSave, defaultSave, loadSave, SAVE_KEY, writeSave, type KeyValueStore } from '../src/save/storage';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('storage', () => {
  it('저장한 내용을 그대로 불러온다', () => {
    const store = memoryStore();
    const save = defaultSave();
    save.cat.furColor = '#e8a45c';
    save.cat.pattern = 'cheese';
    save.settings.muteCat = true;
    save.hunger = 42;
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store)).toEqual(save);
  });

  it('저장된 것이 없으면 null', () => {
    expect(loadSave(memoryStore())).toBeNull();
  });

  it('손상된 JSON이면 null (예외를 던지지 않음)', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSave(store)).toBeNull();
  });

  it('버전이 다르면 null', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), version: 999 }));
    expect(loadSave(store)).toBeNull();
  });

  it('잘못된 값은 기본값으로 바로잡는다', () => {
    const store = memoryStore();
    const bad = { ...defaultSave(), hunger: 'x', cat: { furColor: 'red;', pattern: 'zebra', eyeColor: 1, stage: 'old' } };
    store.setItem(SAVE_KEY, JSON.stringify(bad));
    const loaded = loadSave(store)!;
    const def = defaultSave();
    expect(loaded.cat).toEqual(def.cat);
    expect(loaded.hunger).toBe(def.hunger);
  });

  it('저장소가 예외를 던져도 앱이 멈추지 않는다', () => {
    const throwing: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(loadSave(throwing)).toBeNull();
    expect(writeSave(throwing, defaultSave())).toBe(false);
    expect(() => clearSave(throwing)).not.toThrow();
  });
});
