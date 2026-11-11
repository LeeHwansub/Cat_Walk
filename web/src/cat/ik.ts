/**
 * 2관절 다리 IK (평면). 어깨/엉덩이에서 발까지의 목표 오프셋(dz: 앞+, dy: 위+)을 받아
 * 위쪽 뼈 각도(upper)와 무릎 각도(lower)를 돌려준다.
 * 각도 기준: 0 = 바로 아래, + = 발이 앞쪽(+z)으로 향함.
 * bend = 1 이면 무릎이 뒤로(앞다리 팔꿈치), -1 이면 앞으로(뒷다리 무릎) 꺾인다.
 */
export function solveTwoBone(a: number, b: number, dz: number, dy: number, bend: 1 | -1): { upper: number; lower: number } {
  const maxReach = a + b - 1e-4;
  const minReach = Math.abs(a - b) + 1e-3;
  let d = Math.hypot(dz, dy);
  const dirAngle = d > 1e-6 ? Math.atan2(dz, -dy) : 0;
  if (d >= maxReach) return { upper: dirAngle, lower: 0 }; // 닿지 않으면 곧게 편다
  d = Math.min(Math.max(d, minReach), maxReach);

  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const cosK = (a * a + b * b - d * d) / (2 * a * b);
  const knee = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosK)));

  return { upper: dirAngle + bend * alpha, lower: -bend * knee };
}
