import { groundAt, isFree, STEP_UP, type CollisionWorld } from '../world/collision';

/**
 * 점프 (J-2, docs/10-jump-plan.md): 착지할 곳 찾기 · 포물선 높이 · 단계별 자세 비율.
 * 거리·높이는 성체 기준(m)이고 고양이 크기 scale을 곱한다.
 */
export const JUMP = {
  /** 올라갈 수 있는 높이 (성체 1.5m: 담 1.3~1.44, 차 보닛 0.97) */
  maxUp: 1.5,
  /** 착지점을 찾는 앞쪽 거리 범위 */
  minDist: 0.25,
  maxDist: 1.2,
  /** 뛰어내릴 때 착지점 최소 거리 (가장자리 바로 밑에 떨어지지 않게) */
  downMin: 0.45,
  /** 단계 시간 (초) */
  crouch: 0.18,
  land: 0.22,
  /** 제자리 뛰기 체공 시간 */
  hop: 0.3,
} as const;

export interface Landing {
  x: number;
  z: number;
  y: number;
  /** 궤적 모양 (jumpPoint): 0이면 앞으로 고르게, 클수록 올라갈 때는 먼저 솟고 내려갈 때는 먼저 앞으로 나간다 */
  lead: number;
}

/** 경로가 막히면 차례로 시도하는 궤적 모양 (바짝 붙어 뛰거나 가장자리에서 뛰어내릴 때) */
const LEADS = [0, 0.2, 0.4, 0.55];
/** 경로 확인 표본 수 */
const SAMPLES = 24;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 점프 궤적 위의 한 점 (t: 0~1). 높이는 jumpArcY, 앞으로 나아간 비율은 lead에 따라:
 * 올라갈 때는 t < lead 동안 제자리에서 솟고, 내려갈 때는 t = 1 − lead에 이미 앞으로 다 나가 있다
 */
export function jumpPoint(x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, lead: number, t: number, scale: number): Landing {
  const p = y1 > y0 ? clamp01((t - lead) / (1 - lead)) : clamp01(t / (1 - lead));
  return { x: x0 + (x1 - x0) * p, z: z0 + (z1 - z0) * p, y: jumpArcY(y0, y1, t, scale), lead };
}

/** 날아가는 동안 그 높이에서 막히는 곳(올라설 수 없는 물체·더 높은 윗면의 옆면)을 지나지 않는 궤적 모양. 없으면 null */
function clearLead(world: CollisionWorld, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, scale: number, r: number): number | null {
  for (const lead of LEADS) {
    let ok = true;
    for (let i = 1; i <= SAMPLES && ok; i++) {
      const q = jumpPoint(x0, z0, y0, x1, z1, y1, lead, i / SAMPLES, scale);
      ok = isFree(world, q.x, q.z, r, q.y);
    }
    if (ok) return lead;
  }
  return null;
}

/** 착지점 탐색 간격 (m) */
const STEP = 0.04;

/**
 * 바라보는 쪽(heading) 앞에서 착지할 곳을 찾는다.
 * 1) 올라설 수 있는 더 높은 윗면(지금 높이 + 턱 초과, + maxUp 이하)이 있으면 그 위, 폭의 가운데쯤
 * 2) 없고 높은 곳에 있으면 앞쪽 낮은 땅으로 뛰어내리기
 * 3) 둘 다 없으면 null (제자리 뛰기)
 * 날아가는 경로가 막히는 착지점(사이에 기둥, 실내 위로 넘기, 건물 쪽)은 쓰지 않는다
 */
export function findLanding(world: CollisionWorld, x: number, z: number, y: number, heading: number, scale: number, r: number): Landing | null {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const reach = y + JUMP.maxUp * scale;
  const at = (d: number) => [x + fx * d, z + fz * d] as const;
  // 1) 위로
  for (let d = JUMP.minDist * scale; d <= JUMP.maxDist * scale; d += STEP) {
    const [px, pz] = at(d);
    const top = groundAt(world, px, pz, reach - STEP_UP);
    if (top <= y + STEP_UP || !isFree(world, px, pz, r, top)) continue;
    // 같은 윗면이 이어지는 끝까지 본 뒤 가운데에 내린다 (좁은 담 가장자리에 걸치지 않게)
    let far = d;
    for (let e = d + STEP; e <= d + 0.4 * scale; e += STEP) {
      const [qx, qz] = at(e);
      if (Math.abs(groundAt(world, qx, qz, reach - STEP_UP) - top) > 1e-6 || !isFree(world, qx, qz, r, top)) break;
      far = e;
    }
    const [lx, lz] = at((d + far) / 2);
    const lead = clearLead(world, x, z, y, lx, lz, top, scale, r);
    if (lead !== null) return { x: lx, z: lz, y: top, lead };
  }
  // 2) 아래로
  if (y > STEP_UP) {
    for (let d = JUMP.downMin * scale; d <= JUMP.maxDist * scale; d += STEP) {
      const [px, pz] = at(d);
      const g = groundAt(world, px, pz, y);
      if (g >= y - STEP_UP) continue;
      // 가장자리 바로 밑(몸이 걸림)이면 조금 더 멀리. 건물 쪽은 경로가 막혀 끝까지 못 찾는다
      if (!isFree(world, px, pz, r, g)) continue;
      const lead = clearLead(world, x, z, y, px, pz, g, scale, r);
      if (lead !== null) return { x: px, z: pz, y: g, lead };
    }
  }
  return null;
}

/**
 * 포물선 높이. t: 0~1. 올라갈 때는 끝(t = 1)에서 내려오며 닿도록 꼭대기를 충분히 높게
 * (오르는 도중에 담 모서리를 아래에서 뚫지 않게)
 */
export function jumpArcY(y0: number, y1: number, t: number, scale: number): number {
  const dy = y1 - y0;
  // 뛰어내릴 때도 살짝 솟았다가 떨어진다 (출발한 윗면 가장자리를 파고들지 않게)
  const h = 0.12 * scale + Math.max(0, dy) * 0.35 + Math.max(0, -dy) * 0.1;
  return y0 + dy * t + h * 4 * t * (1 - t);
}

export type JumpPhase = 'crouch' | 'air' | 'land';
export interface JumpWeights {
  crouch: number;
  launch: number;
  air: number;
  land: number;
}

const smooth = (v: number) => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

/** 단계와 진행(0~1)에 따른 자세 비율: 웅크리기 → 도약(몸 뻗기) → 공중(다리 모으기) → 착지(앞발 먼저) */
export function jumpWeights(phase: JumpPhase, t: number): JumpWeights {
  if (phase === 'crouch') return { crouch: smooth(t), launch: 0, air: 0, land: 0 };
  if (phase === 'land') return { crouch: 0, launch: 0, air: 0, land: 1 - smooth(t) };
  const launch = 1 - smooth(t / 0.35);
  const land = smooth((t - 0.75) / 0.25);
  return { crouch: Math.max(0, 1 - t / 0.1), launch, air: Math.max(0, 1 - launch - land), land };
}

/** 체공 시간 (초): 거리·높이 차이가 클수록 길게 */
export function airTime(dist: number, dy: number, scale: number): number {
  return 0.3 + 0.25 * Math.sqrt((dist + Math.abs(dy)) / Math.max(0.3, scale));
}
