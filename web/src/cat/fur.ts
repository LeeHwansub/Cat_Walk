import type { GrowthStage } from './appearance';

/**
 * 털 품질 (지시서 2단계 1번: 데스크톱은 shell fur, 모바일은 가벼운 텍스처).
 * - high/medium: 몸 위에 털 겹(shell)을 여러 장 덧씌운다
 * - low: 겹 없이 털결 텍스처(요철)만
 * - auto: 기기에 맞춰 고른다. 지금은 터치 기기면 low (정식 자동 감지는 4단계 9번)
 */
export type FurQuality = 'auto' | 'high' | 'medium' | 'low';
export type ResolvedFurQuality = Exclude<FurQuality, 'auto'>;

const FUR_QUALITIES: readonly FurQuality[] = ['auto', 'high', 'medium', 'low'];
const SHELLS: Record<ResolvedFurQuality, number> = { high: 10, medium: 5, low: 0 };

export function isFurQuality(v: unknown): v is FurQuality {
  return typeof v === 'string' && (FUR_QUALITIES as readonly string[]).includes(v);
}

export function resolveFurQuality(q: FurQuality, coarsePointer: boolean): ResolvedFurQuality {
  if (q !== 'auto') return q;
  return coarsePointer ? 'low' : 'high';
}

export function shellCount(q: ResolvedFurQuality): number {
  return SHELLS[q];
}

/** 각 겹의 높이 비율 (0 = 피부, 1 = 털 끝) */
export function shellLayers(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i + 1) / n);
}

/** 털 길이 (성체 기준 m). 아기는 더 길고 보송하다 */
export function furLength(stage: GrowthStage): number {
  return stage === 'kitten' ? 0.0095 : 0.006;
}
