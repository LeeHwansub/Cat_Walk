import type * as THREE from 'three';
import type { CatAppearance } from './appearance';
import type { ResolvedFurQuality } from './fur';
import type { CatPose } from './pose';

/** 머리 메시가 쓰는 레이어. 캣캠은 이 레이어를 렌더링하지 않아 머리에 시야가 가리지 않는다. */
export const HEAD_LAYER = 1;

/**
 * 고양이 모델 인터페이스. 지금은 ProceduralCatRig 하나뿐이지만,
 * 나중에 리깅된 glTF 모델로 바꿀 때 이 인터페이스만 구현하면 된다. (D-14)
 */
export interface CatRig {
  /** 지면에 놓이는 루트. 위치와 방향은 컨트롤러가 정한다. */
  readonly root: THREE.Group;
  /** 캣캠 위치 (어깨 위, 가슴과 앞발을 내려다봄) */
  readonly eyeAnchor: THREE.Object3D;
  /** 걷기 한 주기 동안 몸이 나아가는 거리 (m). 발 미끄러짐 방지용 */
  readonly cycleLength: number;
  setAppearance(appearance: CatAppearance): void;
  apply(pose: CatPose, time: number): void;
  /** 작은 반응: 귀를 한 번 움찔한다 (먹는 중 이동 키를 눌렀을 때 등) */
  twitchEar(): void;
  /** 털 표현 품질 */
  setFurQuality(q: ResolvedFurQuality): void;
}
