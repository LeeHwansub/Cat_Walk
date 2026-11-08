import { isFurQuality, type FurQuality } from '../cat/fur';
import { clampBuild, clampSize, defaultAppearance, isEarType, isHexColor, isPattern, isStage, type CatAppearance } from '../cat/appearance';

/** localStorage와 같은 모양의 저장소. 테스트에서 메모리 저장소로 바꿔 끼운다. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Settings {
  muteAll: boolean;
  muteCat: boolean;
  /** 캣캠 흔들림 줄이기 */
  reduceCamShake: boolean;
  /** 털 표현 품질 (auto: 기기에 맞춤) */
  furQuality: FurQuality;
}

export interface SaveData {
  version: 1;
  cat: CatAppearance;
  settings: Settings;
  hunger: number;
  position: { x: number; z: number } | null;
}

export const SAVE_KEY = 'cat-walk/save';
const VERSION = 1;

export function defaultSettings(): Settings {
  return { muteAll: false, muteCat: false, reduceCamShake: true, furQuality: 'auto' };
}

export function defaultSave(): SaveData {
  return { version: VERSION, cat: defaultAppearance(), settings: defaultSettings(), hunger: 80, position: null };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitize(raw: unknown): SaveData | null {
  if (!isRecord(raw) || raw.version !== VERSION) return null;
  const def = defaultSave();
  const cat = isRecord(raw.cat) ? raw.cat : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const pos = isRecord(raw.position) && finite(raw.position.x) && finite(raw.position.z) ? { x: raw.position.x, z: raw.position.z } : null;
  const stage = isStage(cat.stage) ? cat.stage : def.cat.stage;
  return {
    version: VERSION,
    cat: {
      furColor: isHexColor(cat.furColor) ? cat.furColor : def.cat.furColor,
      pattern: isPattern(cat.pattern) ? cat.pattern : def.cat.pattern,
      eyeColor: isHexColor(cat.eyeColor) ? cat.eyeColor : def.cat.eyeColor,
      stage,
      size: typeof cat.size === 'number' ? clampSize(stage, cat.size) : 1,
      build: typeof cat.build === 'number' ? clampBuild(cat.build) : 1,
      ear: isEarType(cat.ear) ? cat.ear : 'up',
    },
    settings: {
      muteAll: typeof settings.muteAll === 'boolean' ? settings.muteAll : def.settings.muteAll,
      muteCat: typeof settings.muteCat === 'boolean' ? settings.muteCat : def.settings.muteCat,
      reduceCamShake: typeof settings.reduceCamShake === 'boolean' ? settings.reduceCamShake : def.settings.reduceCamShake,
      furQuality: isFurQuality(settings.furQuality) ? settings.furQuality : def.settings.furQuality,
    },
    hunger: finite(raw.hunger) ? Math.min(100, Math.max(0, raw.hunger)) : def.hunger,
    position: pos,
  };
}

export function loadSave(store: KeyValueStore): SaveData | null {
  try {
    const text = store.getItem(SAVE_KEY);
    if (text === null) return null;
    return sanitize(JSON.parse(text));
  } catch {
    return null;
  }
}

export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store: KeyValueStore): void {
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    /* 저장소 접근이 막힌 환경에서도 앱은 계속 동작한다 */
  }
}

/** 브라우저 localStorage. 접근 자체가 막힌 환경이면 메모리 저장소로 대체한다. */
export function browserStore(): KeyValueStore {
  try {
    const ls = window.localStorage;
    const probe = '__cat_walk_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}
