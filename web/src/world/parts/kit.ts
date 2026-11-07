import * as THREE from 'three';
import type { InterestKind } from '../../behavior/types';
import type { Rng } from '../../core/rng';
import type { Circle, Rect } from '../collision';

export interface Interest {
  kind: InterestKind;
  x: number;
  z: number;
  r: number;
}

/** 맵 구역 하나 (골목, 공원 …). 구역 단위로 그리기 호출을 합치고, 나중에 가까운 구역만 그린다 */
export interface Zone {
  id: string;
  group: THREE.Group;
}

/**
 * 맵 부품 공용 도구: 도형을 그리고 충돌·관심 지점·카메라 가림 물체를 모은다.
 * 부품 함수(parts/*)와 구역 배치(zones/*)가 이 도구를 받아 쓴다.
 * 무작위 배치는 rng 하나를 순서대로 쓰므로, 호출 순서를 바꾸면 모양이 바뀐다.
 */
export class MapKit {
  /** 맵 전체 (구역 그룹들의 부모) */
  readonly root = new THREE.Group();
  /** 지금 그리는 곳 (beginZone으로 바꾼다) */
  group: THREE.Group;
  readonly zones: Zone[] = [];
  readonly rects: Rect[] = [];
  readonly circles: Circle[] = [];
  readonly interests: Interest[] = [];
  /** 카메라가 뚫고 들어가지 않게 레이캐스트할 큰 물체 */
  readonly occluders: THREE.Object3D[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(readonly rng: Rng) {
    this.group = this.beginZone('shared');
  }

  /** 새 구역을 시작한다. 이후 그리는 물체는 이 구역 그룹에 들어간다 */
  beginZone(id: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `zone:${id}`;
    this.root.add(group);
    this.zones.push({ id, group });
    this.group = group;
    return group;
  }

  /** 같은 색·거칠기의 재질은 하나를 함께 쓴다 (그리기 호출 합치기의 기준) */
  mat(color: string, rough = 0.9): THREE.MeshStandardMaterial {
    const key = `${color}/${rough}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough });
      this.mats.set(key, m);
    }
    return m;
  }

  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  /** 바닥에 붙인 얇은 판 (노면 표시, 산책로) */
  flat(w: number, d: number, mat: THREE.Material, x: number, z: number, rotY = 0): void {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.set(-Math.PI / 2, 0, rotY);
    m.position.set(x, 0.004, z);
    m.receiveShadow = true;
    this.group.add(m);
  }

  solidRect(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.rects.push({ minX, maxX, minZ, maxZ });
  }
}
