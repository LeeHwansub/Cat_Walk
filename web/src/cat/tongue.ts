/**
 * 혀 내밀기 정도 (0 = 넣음, 1 = 다 내밂). 그루밍·밥 먹기·입맛 다시기에서 핥는 리듬으로 움직인다.
 * 냄새 맡기(핥기 0.3)처럼 약하게 입만 움찔할 때는 혀를 내밀지 않는다 (2026-11-08 사용자 "그루밍 할 때 혀 형상화")
 */
export function tongueOut(lick: number, time: number): number {
  if (lick < 0.35) return 0;
  const strength = Math.min(1, (lick - 0.35) / 0.65);
  const lap = Math.max(0, Math.sin(time * 14));
  return strength * (0.25 + 0.75 * lap);
}

/**
 * 혀 보류 (2026-11-08 사용자 "혀가 턱을 뚫는 버그, 입 벌린 색감과 이가 무서움 … 잠깐 킵", "일단 끄기").
 * 턱 뚫림·입 안 모습을 고칠 때까지 끈다. 다시 켜려면 true로
 */
export const TONGUE_ON = false;

/** 화면에 보일 혀 내밀기 정도: 꺼져 있거나 1인칭(머리를 숨김)이면 0 */
export function tongueShown(lick: number, time: number, firstPerson: boolean, on = TONGUE_ON): number {
  return on && !firstPerson ? tongueOut(lick, time) : 0;
}
