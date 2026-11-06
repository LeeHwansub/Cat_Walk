import { describe, expect, it } from 'vitest';
import { defaultAppearance, isAccessory, isEarType, isPattern, PRESETS } from '../src/cat/appearance';
import { defaultSave, loadSave, SAVE_KEY, type KeyValueStore } from '../src/save/storage';

const byLabel = (l: string) => PRESETS.find((p) => p.label === l)!.appearance;

describe('뽀리·레오 프리셋 (지시서 2단계 1번)', () => {
  it('목록 맨 앞에 뽀리, 레오가 있고 기존 프리셋 5개도 남아 있다', () => {
    expect(PRESETS.slice(0, 2).map((p) => p.label)).toEqual(['뽀리', '레오']);
    expect(PRESETS.length).toBe(7);
  });

  it('뽀리: 브라운 태비 + 흰 양말 무늬, 분홍 하트 목걸이, 황록색 눈, 접힌 귀, 통통', () => {
    const a = byLabel('뽀리');
    expect(a.pattern).toBe('tabbyWhite');
    expect(a.accessory).toBe('heartTag');
    expect(a.eyeColor).toBe('#b5c23a');
    expect(a.ear).toBe('fold');
    expect(a.build).toBeGreaterThanOrEqual(1.15);
  });

  it('레오: 크림 치즈 태비, 황록색 눈, 접힌 귀, 통통, 목걸이 없음', () => {
    const a = byLabel('레오');
    expect(a.pattern).toBe('cheese');
    expect(a.eyeColor).toBe('#b5c23a');
    expect(a.ear).toBe('fold');
    expect(a.accessory).toBe('none');
    expect(a.build).toBeGreaterThanOrEqual(1.15);
  });

  it('처음 시작할 때의 기본 고양이는 그대로(치즈냥, 선 귀)', () => {
    const d = defaultAppearance();
    expect(d.pattern).toBe('cheese');
    expect(d.ear).toBe('up');
    expect(d.accessory).toBe('none');
  });

  it('새 값 검사', () => {
    expect(isPattern('tabbyWhite')).toBe(true);
    expect(isEarType('fold')).toBe(true);
    expect(isEarType('down')).toBe(false);
    expect(isAccessory('heartTag')).toBe(true);
    expect(isAccessory('crown')).toBe(false);
  });
});

describe('저장 — 귀 형태와 목걸이', () => {
  function mem(): KeyValueStore {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }

  it('이전 저장(귀·목걸이 값 없음)을 불러오면 선 귀, 목걸이 없음', () => {
    const store = mem();
    const { ear: _e, accessory: _a, ...old } = defaultSave().cat;
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: old }));
    const c = loadSave(store)!.cat;
    expect(c.ear).toBe('up');
    expect(c.accessory).toBe('none');
  });

  it('잘못된 값은 기본값으로', () => {
    const store = mem();
    store.setItem(SAVE_KEY, JSON.stringify({ ...defaultSave(), cat: { ...defaultSave().cat, ear: 'x', accessory: 9 } }));
    const c = loadSave(store)!.cat;
    expect(c.ear).toBe('up');
    expect(c.accessory).toBe('none');
  });
});
