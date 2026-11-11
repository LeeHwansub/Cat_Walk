import * as THREE from 'three';
import type { InterestKind } from '../../behavior/types';
import type { Rng } from '../../core/rng';
import type { Circle, Rect } from '../collision';
import { recolorBody, type PropId, type PropModels } from '../propModels';

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
  /** 구역 합치기에서 뺄 물체 (정점 색 모델: 합치기가 색 속성을 지운다) */
  readonly unmerged: THREE.Object3D[] = [];
  /** 불러온 소품 모델 (없는 것은 prop()이 상자로 대신한다) */
  models: PropModels = {};
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly tints = new Map<string, THREE.Mesh>();

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

  /**
   * 소품 하나를 놓는다: 모델이 있으면 복제(도형·재질 공유), 없으면 같은 크기의 상자 (fallback: 폭·높이·깊이·색).
   * 충돌·관심 지점은 부르는 쪽이 정한다 (모델이 있든 없든 같게). rotY: 모델의 앞(+z)이 향할 방향
   */
  prop(id: PropId, x: number, z: number, rotY: number, fallback: { w: number; h: number; d: number; color: string }, tint?: string): THREE.Object3D {
    const model = this.tinted(id, tint);
    let o: THREE.Object3D;
    if (model) {
      o = model.clone();
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(fallback.w, fallback.h, fallback.d), this.mat(fallback.color));
      m.geometry.translate(0, fallback.h / 2, 0);
      m.castShadow = m.receiveShadow = true;
      o = m;
    }
    o.position.set(x, 0, z);
    o.rotation.y = rotY;
    o.userData.prop = id;
    this.group.add(o);
    this.unmerged.push(o);
    return o;
  }

  /**
   * 작은 소품(들꽃·풀 포기 …)을 여러 곳에 흩뿌린다: 종류마다 InstancedMesh 하나 (그리기 호출 1회).
   * 장식이라 모델이 없으면 놓지 않고 null. 충돌·관심 지점은 없다
   */
  scatter(id: PropId, items: { x: number; z: number; rotY: number; scale: number }[]): THREE.InstancedMesh | null {
    const model = this.models[id] as THREE.Mesh | undefined;
    if (!model || items.length === 0) return null;
    const inst = new THREE.InstancedMesh(model.geometry, model.material, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => inst.setMatrixAt(i, m.compose(new THREE.Vector3(it.x, 0, it.z), q.setFromAxisAngle(up, it.rotY), new THREE.Vector3(it.scale, it.scale, it.scale))));
    inst.castShadow = false; // 작은 장식은 그림자를 끈다 (그리기 부담)
    inst.receiveShadow = true;
    inst.userData.prop = id;
    this.group.add(inst);
    return inst;
  }

  /** tint가 있으면 차체 색만 바꾼 모델 (모델·색마다 한 번 만들어 함께 쓴다) */
  private tinted(id: PropId, tint?: string): THREE.Object3D | undefined {
    const model = this.models[id];
    if (!model || !tint) return model;
    const key = `${id}/${tint}`;
    let m = this.tints.get(key);
    if (!m) this.tints.set(key, (m = recolorBody(model as THREE.Mesh, tint)));
    return m;
  }

  /** 몸을 막는 사각형. top: 올라설 수 있는 윗면 높이(m), 없으면 올라설 수 없다 (J-0) */
  solidRect(minX: number, maxX: number, minZ: number, maxZ: number, top?: number): void {
    this.rects.push(top === undefined ? { minX, maxX, minZ, maxZ } : { minX, maxX, minZ, maxZ, top });
  }
}
