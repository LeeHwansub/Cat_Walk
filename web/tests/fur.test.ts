import { describe, expect, it } from 'vitest';
import { furLength, isFurQuality, resolveFurQuality, shellCount, shellLayers } from '../src/cat/fur';
import { defaultSave, loadSave, SAVE_KEY, type KeyValueStore } from '../src/save/storage';

function store(raw: unknown): KeyValueStore {
  const data = new Map([[SAVE_KEY, JSON.stringify(raw)]]);
  return { getItem: (k) => data.get(k) ?? null, setItem: () => {}, removeItem: () => {} };
}

describe('털 품질', () => {
  it('자동이면 터치 기기(모바일)는 텍스처만, 그 외는 풍성하게', () => {
    expect(resolveFurQuality('auto', true)).toBe('low');
    expect(resolveFurQuality('auto', false)).toBe('high');
    expect(resolveFurQuality('medium', true)).toBe('medium');
  });

  it('겹 수: 높음 > 보통 > 낮음(0, 텍스처만)', () => {
    expect(shellCount('high')).toBeGreaterThan(shellCount('medium'));
    expect(shellCount('medium')).toBeGreaterThan(0);
    expect(shellCount('low')).toBe(0);
  });

  it('겹은 안쪽에서 바깥쪽으로 0~1 사이에 고르게 놓이고 마지막 겹이 털 끝(1)이다', () => {
    const l = shellLayers(5);
    expect(l).toHaveLength(5);
    expect(l[4]).toBe(1);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
    expect(l[0]).toBeGreaterThan(0);
  });

  it('아기 고양이 털이 더 길고 보송하다', () => {
    expect(furLength('kitten')).toBeGreaterThan(furLength('adult'));
  });

  it('잘못된 값은 품질 값으로 인정하지 않는다', () => {
    expect(isFurQuality('high')).toBe(true);
    expect(isFurQuality('ultra')).toBe(false);
  });
});

describe('털 품질 저장', () => {
  it('저장된 값을 불러오고, 없거나 잘못되면 자동(auto)', () => {
    const base = defaultSave();
    expect(base.settings.furQuality).toBe('auto');
    expect(loadSave(store({ ...base, settings: { ...base.settings, furQuality: 'medium' } }))!.settings.furQuality).toBe('medium');
    expect(loadSave(store({ ...base, settings: { muteAll: false } }))!.settings.furQuality).toBe('auto');
    expect(loadSave(store({ ...base, settings: { ...base.settings, furQuality: 'ultra' } }))!.settings.furQuality).toBe('auto');
  });
});
