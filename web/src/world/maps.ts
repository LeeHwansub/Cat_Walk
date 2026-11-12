import * as THREE from 'three';
import { buildMeadow } from './map/meadow';
import { buildNeighborhood, type Neighborhood } from './map/neighborhood';
import type { PropModels } from './propModels';

/**
 * 고를 수 있는 맵 목록 (D-58: 여러 맵, 지도 메뉴로 고르기).
 * 맵마다 같은 모양(Neighborhood: 그룹·충돌·관심 지점·출발점·먹이 쉼터·주민 자리)을 돌려준다.
 */
export interface MapDef {
  id: string;
  /** 지도 메뉴에 보이는 이름 */
  name: string;
  /** 한 줄 소개 */
  blurb: string;
  build(models: PropModels): Neighborhood;
}

export const DEFAULT_MAP_ID = 'neighborhood';

export const MAPS: readonly MapDef[] = [
  { id: DEFAULT_MAP_ID, name: '골목과 공원', blurb: '주택가 골목과 연못이 있는 작은 공원', build: buildNeighborhood },
  { id: 'meadow', name: '들판', blurb: '꽃이 핀 넓은 풀밭과 부들이 자라는 연못', build: buildMeadow },
];

/** id에 맞는 맵. 없으면(지워진 맵, 손상된 저장) 기본 맵 */
export function mapById(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === DEFAULT_MAP_ID)!;
}

/**
 * 맵을 바꿀 때 이전 맵의 도형·재질·텍스처를 GPU에서 내린다. 돌려주는 값은 정리한 도형 수.
 * 소품 모델(models)의 도형·재질은 다음 맵도 함께 쓰므로 남긴다.
 */
export function disposeMap(map: Neighborhood, models: PropModels): number {
  const shared = new Set<unknown>();
  for (const m of Object.values(models)) {
    m?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      shared.add(mesh.geometry);
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) shared.add(mat);
    });
  }
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  map.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!shared.has(mesh.geometry)) geos.add(mesh.geometry);
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!shared.has(mat)) mats.add(mat);
  });
  for (const g of geos) g.dispose();
  for (const mat of mats) {
    for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose();
    mat.dispose();
  }
  map.group.removeFromParent();
  return geos.size;
}
