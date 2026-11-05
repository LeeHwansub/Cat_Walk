export type PatternId = 'solid' | 'tuxedo' | 'cheese' | 'mackerel' | 'calico';
export type GrowthStage = 'kitten' | 'adult';

export interface CatAppearance {
  furColor: string;
  pattern: PatternId;
  eyeColor: string;
  stage: GrowthStage;
}

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'solid', label: '단색' },
  { id: 'tuxedo', label: '턱시도' },
  { id: 'cheese', label: '치즈' },
  { id: 'mackerel', label: '고등어' },
  { id: 'calico', label: '삼색' },
];

export const FUR_COLORS: { hex: string; label: string }[] = [
  { hex: '#f4efe6', label: '흰색' },
  { hex: '#e39a4f', label: '주황' },
  { hex: '#8d8a86', label: '회색' },
  { hex: '#6e5a48', label: '갈색' },
  { hex: '#d9c3a0', label: '크림' },
  { hex: '#2b2a2c', label: '검정' },
];

export const EYE_COLORS: { hex: string; label: string }[] = [
  { hex: '#d9b53a', label: '노랑' },
  { hex: '#7fae4a', label: '초록' },
  { hex: '#5f9fd6', label: '파랑' },
  { hex: '#c9822f', label: '호박' },
];

export const PRESETS: { label: string; appearance: CatAppearance }[] = [
  { label: '치즈냥', appearance: { furColor: '#e39a4f', pattern: 'cheese', eyeColor: '#d9b53a', stage: 'adult' } },
  { label: '고등어', appearance: { furColor: '#8d8a86', pattern: 'mackerel', eyeColor: '#7fae4a', stage: 'adult' } },
  { label: '턱시도', appearance: { furColor: '#2b2a2c', pattern: 'tuxedo', eyeColor: '#d9b53a', stage: 'adult' } },
  { label: '삼색이', appearance: { furColor: '#e39a4f', pattern: 'calico', eyeColor: '#c9822f', stage: 'adult' } },
  { label: '흰냥이', appearance: { furColor: '#f4efe6', pattern: 'solid', eyeColor: '#5f9fd6', stage: 'adult' } },
];

export function defaultAppearance(): CatAppearance {
  return { ...PRESETS[0].appearance };
}

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

export function isPattern(v: unknown): v is PatternId {
  return PATTERNS.some((p) => p.id === v);
}

export function isStage(v: unknown): v is GrowthStage {
  return v === 'kitten' || v === 'adult';
}
