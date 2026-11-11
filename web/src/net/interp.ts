import type { CatState } from './protocol';

/** 받은 상태와 받은 시각 (내 시계, 초) */
export interface Snapshot {
  t: number;
  s: CatState;
}

/** 이보다 멀리 한 번에 옮기면 잇지 않고 바로 옮긴다 (맵 바꿈·다시 시작) */
const TELEPORT = 3;

function lerpAngle(a: number, b: number, k: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/**
 * t 시각의 다른 고양이 상태: 앞뒤 두 상태 사이를 잇는다 (보통 t = 지금 − 0.15초로 조금 늦게 그려 끊김을 숨긴다).
 * 행동은 t 전의 마지막 상태를 따른다. 범위 밖이면 처음·마지막 상태에 머문다 (앞질러 짐작하지 않음)
 */
export function sampleSnapshots(snaps: readonly Snapshot[], t: number): CatState | null {
  if (snaps.length === 0) return null;
  if (t <= snaps[0].t) return snaps[0].s;
  const last = snaps[snaps.length - 1];
  if (t >= last.t) return last.s;
  let i = 0;
  while (i + 1 < snaps.length && snaps[i + 1].t <= t) i++;
  const a = snaps[i];
  const b = snaps[i + 1];
  if (Math.hypot(b.s.x - a.s.x, b.s.z - a.s.z) > TELEPORT) return a.s;
  const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return {
    ...a.s,
    x: a.s.x + (b.s.x - a.s.x) * k,
    z: a.s.z + (b.s.z - a.s.z) * k,
    y: a.s.y + (b.s.y - a.s.y) * k,
    h: lerpAngle(a.s.h, b.s.h, k),
    p: a.s.p + (b.s.p - a.s.p) * k,
    v: a.s.v + (b.s.v - a.s.v) * k,
    g: a.s.g + (b.s.g - a.s.g) * k,
  };
}

/** 내 상태를 보내는 최소 간격 (초): 1초에 8번까지 */
export const SEND_INTERVAL = 1 / 8;

/**
 * 내 상태를 보낼지 (메시지를 아낀다: Durable Object 요금은 받는 메시지 수로 센다).
 * 처음·자세가 바뀌면 바로, 움직이거나 돌거나 진행이 바뀌면 마지막으로 보낸 지 1/8초 뒤에. 가만히 있으면 보내지 않는다
 */
export function shouldSend(prev: CatState | null, next: CatState, sinceLast: number): boolean {
  if (!prev || prev.b !== next.b) return true;
  if (sinceLast < SEND_INTERVAL) return false;
  return (
    Math.hypot(next.x - prev.x, next.z - prev.z) > 0.02 ||
    Math.abs(next.y - prev.y) > 0.02 ||
    Math.abs(lerpAngle(0, next.h - prev.h, 1)) > 0.03 ||
    Math.abs(next.p - prev.p) > 0.03 ||
    Math.abs(next.v - prev.v) > 0.05 ||
    Math.abs(next.g - prev.g) > 0.05
  );
}
