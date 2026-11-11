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

  it('맵 id를 저장하고, 맵 id가 없는 예전 저장은 골목·공원 동네로 읽는다 (D-58)', () => {
    const store = memoryStore();
    const save = defaultSave();
    save.mapId = 'meadow';
    writeSave(store, save);
    expect(loadSave(store)!.mapId).toBe('meadow');
    const old: Record<string, unknown> = { ...defaultSave(), position: { x: 3, z: 1 } };
    delete old.mapId;
    store.setItem(SAVE_KEY, JSON.stringify(old));
    expect(loadSave(store)!.mapId).toBe('neighborhood');
    expect(loadSave(store)!.position).toEqual({ x: 3, z: 1 }); // 예전 위치는 동네 위치 그대로
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), mapId: 42 }));
    expect(loadSave(store)!.mapId).toBe('neighborhood');
  });

  it('닉네임·함께 놀기를 저장하고, 예전 저장은 닉네임 없음·함께 놀기 켜짐 (D-59)', () => {
    const store = memoryStore();
    const save = defaultSave();
    expect(save.nick).toBe('');
    expect(save.online).toBe(true);
    save.nick = '뽀리';
    save.online = false;
    writeSave(store, save);
    expect(loadSave(store)).toMatchObject({ nick: '뽀리', online: false });
    const old: Record<string, unknown> = { ...defaultSave() };
    delete old.nick;
    delete old.online;
    store.setItem(SAVE_KEY, JSON.stringify(old));
    expect(loadSave(store)).toMatchObject({ nick: '', online: true });
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), nick: '\u0000'.repeat(3) + '가'.repeat(40) }));
    expect(loadSave(store)!.nick).toBe('가'.repeat(12)); // 닉네임 규칙(제어 문자 제거, 12자)
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

describe('storage — 크기 조절 값', () => {
  function mem(): KeyValueStore {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('크기 조절 값을 저장하고 불러온다', () => {
    const store = mem();
    const save = defaultSave();
    save.cat.stage = 'kitten';
    save.cat.size = 0.9;
    writeSave(store, save);
    expect(loadSave(store)!.cat.size).toBe(0.9);
  });

  it('단계 범위를 벗어난 크기는 범위 안으로, 없거나 잘못되면 100%', () => {
    const store = mem();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: { ...defaultSave().cat, stage: 'kitten', size: 1.5 } }));
    expect(loadSave(store)!.cat.size).toBe(1.1);
    const { size: _omit, ...noSize } = defaultSave().cat;
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: noSize }));
    expect(loadSave(store)!.cat.size).toBe(1);
  });
});
