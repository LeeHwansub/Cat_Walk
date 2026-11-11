import { describe, expect, it } from 'vitest';
import { BUILD_RANGE, clampBuild, girthScale } from '../src/cat/appearance';
import { defaultSave, loadSave, SAVE_KEY, writeSave, type KeyValueStore } from '../src/save/storage';

function mem(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('체형 (날씬 ↔ 통통)', () => {
  it('범위는 80%~130%, 기본 100%', () => {
    expect(BUILD_RANGE).toEqual([0.8, 1.3]);
    expect(defaultSave().cat.build).toBe(1);
  });

  it('범위 밖이나 잘못된 값은 바로잡는다', () => {
    expect(clampBuild(2)).toBe(1.3);
    expect(clampBuild(0.1)).toBe(0.8);
    expect(clampBuild(Number.NaN)).toBe(1);
  });

  it('통통할수록 몸통 둘레가 커지고, 날씬할수록 작아진다 (길이는 그대로)', () => {
    expect(girthScale(1)).toBe(1);
    expect(girthScale(1.3)).toBeGreaterThan(1);
    expect(girthScale(0.8)).toBeLessThan(1);
  });

  it('체형 값을 저장하고, 잘못된 값은 바로잡아 불러온다', () => {
    const store = mem();
    const save = defaultSave();
    save.cat.build = 1.25;
    writeSave(store, save);
    expect(loadSave(store)!.cat.build).toBe(1.25);
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: { ...defaultSave().cat, build: 9 } }));
    expect(loadSave(store)!.cat.build).toBe(1.3);
    const { build: _omit, ...noBuild } = defaultSave().cat;
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: noBuild }));
    expect(loadSave(store)!.cat.build).toBe(1);
  });
});
