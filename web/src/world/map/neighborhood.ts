import * as THREE from 'three';
import { createRng } from '../../core/rng';
import type { CollisionWorld, Rect } from '../collision';
import { mergeStatic } from '../merge';
import { backdropApartments } from '../parts/buildings';
import { MapKit, type Interest, type Zone } from '../parts/kit';
import type { MapLight } from '../lighting';
import type { PropModels } from '../propModels';
import { buildAlley, buildFeedingCorner, ROAD_HALF } from '../zones/alley';
import { buildPark } from '../zones/park';

export type { Interest, Zone };

/** 바닥 종류: 눈(발자국이 남음), 돌(광장·길), 얼음 */
export type Surface = 'snow' | 'stone' | 'ice';

/** Blender로 만든 주민 모델 (tools/blender/npc.py) */
export type ResidentKind = 'santa' | 'rudolph';
/** npcSpot 주민이 보는 방향 (모든 맵 같다, 0 = +z) */
export const NPC_FACING = -2.4;

/** from에 선 사람이 to를 보는 방향 (0 = +z, ResidentSpot.facing과 같은 기준) */
export function facingToward(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** 모델 주민 자리. facing: 보는 방향 (0 = +z) */
export interface ResidentSpot {
  kind: ResidentKind;
  x: number;
  z: number;
  facing: number;
  /** 빈 그릇을 채워 주는 주민 (맵에 한 명) */
  feeds: boolean;
}

export interface Neighborhood {
  group: THREE.Group;
  /** 구역별 그룹 (공용 바닥·배경 'shared', 골목 'alley', 공원 'park') */
  zones: Zone[];
  collision: CollisionWorld;
  interests: Interest[];
  /** 카메라가 뚫고 들어가지 않게 레이캐스트할 큰 물체 */
  occluders: THREE.Object3D[];
  spawn: { x: number; z: number; heading: number };
  foodStation: { x: number; z: number };
  npcSpot: { x: number; z: number };
  /** 모델 주민들 (눈 오는 광장만: 산타·루돌프, 4단계). 없으면 npcSpot에 도형 주민 한 명 */
  residents?: ResidentSpot[];
  /** 구역 정리로 줄어든 메시 수 (점검용) */
  mergedAway: number;
  /** 불빛 자리 (가로등 머리, 창문 …). 저녁·밤에 빛 번짐과 점조명 (없으면 불빛 없음) */
  lights?: MapLight[];
  /** 매 프레임 움직이는 것이 있는 맵만 (크리스마스 맵의 눈 내리기). dt: 초 */
  update?: (dt: number) => void;
  /** 이 자리 바닥 종류 (눈 오는 광장만: 눈 위에만 발자국, 보드 X-05). 없으면 발자국이 남지 않는다 */
  surfaceAt?: (x: number, z: number) => Surface;
}

/**
 * MVP 맵: 한국 주택가 골목 + 작은 공원이 이어진 동네 (D-06, D-10).
 * 좌표: x는 서(−)→동(+), 골목 큰길은 x축 방향, 공원은 동쪽 끝.
 * 3-0: 부품(world/parts)과 구역(world/zones)으로 나누고, 구역마다 정적 메시를 합친다.
 */
export const BOUNDS: Rect = { minX: -26, maxX: 24, minZ: -14, maxZ: 14 };

/** models: 불러온 소품 모델 (없으면 같은 크기의 상자로 대신한다) */
export function buildNeighborhood(models: PropModels = {}): Neighborhood {
  const k = new MapKit(createRng(2026));
  k.models = models;
  groundOuter(k);

  const { foodStation } = buildAlley(k, BOUNDS);
  buildPark(k, BOUNDS, ROAD_HALF);
  buildFeedingCorner(k, foodStation);

  // 배경: 멀리 보이는 아파트 (이동 불가, 풍경용)
  k.group = k.zones[0].group;
  backdropApartments(k);

  // 구역마다 움직이지 않는 작은 물체를 재질별로 합친다 (카메라 가림 물체는 제외)
  const keep = new Set([...k.occluders, ...k.unmerged]);
  let mergedAway = 0;
  for (const z of k.zones) mergedAway += mergeStatic(z.group, keep);

  return {
    group: k.root,
    zones: k.zones,
    collision: { bounds: BOUNDS, rects: k.rects, circles: k.circles },
    interests: k.interests,
    occluders: k.occluders,
    spawn: { x: -6, z: 0.3, heading: Math.PI / 2 },
    foodStation,
    npcSpot: { x: 1.7, z: 2.6 },
    mergedAway,
    lights: k.lights,
  };
}

/** 동네 바깥 땅 (지평선까지 이어지게) */
function groundOuter(k: MapKit): void {
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), k.mat('#8d8a80'));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  k.group.add(outer);
}
