/**
 * 고양이 자세를 모델과 무관한 값으로 표현한다. (D-14: 모델 교체 가능한 구조)
 * 행동 코드는 이 값만 만들고, 모델(CatRig)이 각자 방식으로 해석한다.
 */
export interface CatPose {
  /** 걷기 주기 위상 (이동 거리로 진행) */
  gaitPhase: number;
  /** 0 정지 ~ 1 걷기 */
  speed: number;
  /** 0 서기 ~ 1 앉기 */
  sit: number;
  /** 0 ~ 1 엎드려 웅크리기 (낮잠) */
  lie: number;
  /** 머리 좌우 (라디안, + 왼쪽) */
  headYaw: number;
  /** 머리 위아래 (라디안, + 아래) */
  headPitch: number;
  /** 머리 기울이기 */
  headTilt: number;
  /** 0 꼬리 내림·감기 ~ 1 꼬리 세움 */
  tailUp: number;
  /** 꼬리 흔들림 크기 */
  tailWag: number;
  /** 그루밍: 오른쪽 앞발 들기 0 ~ 1 */
  pawLift: number;
  /** 그루밍: 0 입 앞(핥기) ~ 1 얼굴 닦기 */
  pawToFace: number;
  /** 핥기·먹기 동작 강도 */
  lick: number;
  /** 0 눈 뜸 ~ 1 감음 */
  eyesClosed: number;
  /** 0 ~ 1 풍선처럼 떠 있음 (이스터 에그): 다리를 늘어뜨리고 몸이 더 부푼다 */
  float: number;
}

export function neutralPose(): CatPose {
  return {
    gaitPhase: 0,
    speed: 0,
    sit: 0,
    lie: 0,
    headYaw: 0,
    headPitch: 0.05,
    headTilt: 0,
    tailUp: 0.6,
    tailWag: 0.2,
    pawLift: 0,
    pawToFace: 0,
    lick: 0,
    eyesClosed: 0,
    float: 0,
  };
}
