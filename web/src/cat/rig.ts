import type * as THREE from 'three';
import type { CatAppearance } from './appearance';
import type { ResolvedFurQuality } from './fur';
import type { CatPose } from './pose';

/** 머리 메시가 쓰는 레이어. 캣캠은 이 레이어를 렌더링하지 않아 머리에 시야가 가리지 않는다. */
export const HEAD_LAYER = 1;

/**
 * 고양이 모델 인터페이스 (D-14). 기본은 glb 뼈대 모델 SkinnedCatRig (D-31),
 * 이전 도형 모델 ProceduralCatRig는 비교용으로 남겨 둔다 (?rig=procedural).
 */
export interface CatRig {
  /** 지면에 놓이는 루트. 위치와 방향은 컨트롤러가 정한다. */
  readonly root: THREE.Group;
  /** 캣캠 위치 (어깨 위, 가슴과 앞발을 내려다봄) */
  readonly eyeAnchor: THREE.Object3D;
  /** 걷기 한 주기 동안 몸이 나아가는 거리 (m). 발 미끄러짐 방지용 */
  readonly cycleLength: number;
  /** 달리기 비율(0~1)에 따른 한 주기 거리. 없으면 cycleLength */
  cycleLengthAt?(run: number): number;
  setAppearance(appearance: CatAppearance): void;
  apply(pose: CatPose, time: number): void;
  /** 작은 반응: 귀를 한 번 움찔한다 (먹는 중 이동 키를 눌렀을 때 등) */
  twitchEar(): void;
  /** 털 표현 품질 */
  setFurQuality(q: ResolvedFurQuality): void;
  /** 캣캠(1인칭) 중인지. 머리가 시야를 가리는 모델은 이때 머리를 숨긴다 */
  setFirstPerson?(on: boolean): void;
  /** 3인칭 카메라가 바짝 붙었을 때 몸 전체를 흐리게 (1 = 다 보임) */
  setBodyFade?(fade: number): void;
}
