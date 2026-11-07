/**
 * 풍선 이스터 에그 자세 (2026-11-07 수정, D-44).
 * 이전에는 발을 어깨 30cm 아래(다리 길이보다 길게)에 두어 다리가 일자로 몸 밑에 모였고,
 * 몸통만 옆으로 부풀어 각진 덩어리처럼 보여 "차 위에 서 있는" 모습이었다.
 */

/** 떠 있을 때 발 위치 (몸 기준 m). 바깥·앞뒤로 벌리고 둥글게 허우적거린다 */
export function floatPawTarget(top: { x: number; y: number; z: number }, front: boolean, time: number, phase = 0): { x: number; y: number; z: number } {
  const side = Math.sign(top.x) || 1;
  const a = time * 2.4 + phase * Math.PI * 2;
  return {
    x: top.x + side * (0.05 + 0.012 * Math.sin(a + 1)),
    y: top.y - 0.07 + 0.018 * Math.sin(a),
    z: top.z + (front ? 0.045 : -0.045) + 0.022 * Math.cos(a),
  };
}

/** 몸통을 공 모양으로 당기는 세기 (0 ~ 1, 셰이더 uBalloon) */
export function balloonRound(amount: number): number {
  const t = Math.min(1, Math.max(0, amount));
  return 0.75 * t * t * (3 - 2 * t);
}
