export type PatternId = 'solid' | 'tuxedo' | 'cheese' | 'mackerel' | 'calico';
export type GrowthStage = 'kitten' | 'adult';

export interface CatAppearance {
  furColor: string;
  pattern: PatternId;
  eyeColor: string;
  stage: GrowthStage;
  /** 성장 단계 안에서의 크기 조절 값 (1 = 100%) */
  size: number;
  /** 체형: 날씬(0.8) ↔ 통통(1.3). 몸통 둘레만 바뀌고 길이는 그대로 */
  build: number;
}

/** 체형 조절 범위 (사용자 요청 2026-11-05) */
export const BUILD_RANGE: [number, number] = [0.8, 1.3];

export function clampBuild(build: number): number {
  if (!Number.isFinite(build)) return 1;
  return Math.min(BUILD_RANGE[1], Math.max(BUILD_RANGE[0], build));
}

/** 몸통 둘레 배율 */
export function girthScale(build: number): number {
  return clampBuild(build);
}

/** 성장 단계별 기준 크기 (성체 = 1) */
export const STAGE_BASE_SCALE: Record<GrowthStage, number> = { kitten: 0.62, adult: 1 };

/** 성장 단계별 크기 조절 범위 (D-24) */
export const SIZE_RANGE: Record<GrowthStage, [number, number]> = { kitten: [0.8, 1.1], adult: [0.85, 1.2] };

/** 크기 조절 값을 단계 범위 안으로 맞춘다. 숫자가 아니면 100% */
export function clampSize(stage: GrowthStage, size: number): number {
  if (!Number.isFinite(size)) return 1;
  const [min, max] = SIZE_RANGE[stage];
  return Math.min(max, Math.max(min, size));
}

/** 실제 크기 = 단계 기준 크기 × 크기 조절 값 */
export function effectiveScale(stage: GrowthStage, size: number): number {
  return STAGE_BASE_SCALE[stage] * clampSize(stage, size);
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
  { label: '치즈냥', appearance: { furColor: '#e39a4f', pattern: 'cheese', eyeColor: '#d9b53a', stage: 'adult', size: 1, build: 1 } },
  { label: '고등어', appearance: { furColor: '#8d8a86', pattern: 'mackerel', eyeColor: '#7fae4a', stage: 'adult', size: 1, build: 1 } },
  { label: '턱시도', appearance: { furColor: '#2b2a2c', pattern: 'tuxedo', eyeColor: '#d9b53a', stage: 'adult', size: 1, build: 1 } },
  { label: '삼색이', appearance: { furColor: '#e39a4f', pattern: 'calico', eyeColor: '#c9822f', stage: 'adult', size: 1, build: 1 } },
  { label: '흰냥이', appearance: { furColor: '#f4efe6', pattern: 'solid', eyeColor: '#5f9fd6', stage: 'adult', size: 1, build: 1 } },
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
