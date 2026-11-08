import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 구역 안의 움직이지 않는 메시를 재질·그림자 설정이 같은 것끼리 하나로 합친다 (그리기 호출 줄이기, 3-0).
 * - keep에 든 물체와 그 자식(카메라 가림 물체: 건물·담·차 등)은 합치지 않는다
 * - InstancedMesh, SkinnedMesh, 투명 재질은 합치지 않는다. 단 재질 userData.mergeable이 참인 투명 재질
 *   (빗물 자국처럼 같은 판 여러 장, 그리는 순서가 상관없는 것)은 합친다
 * - 원래 위치·회전·크기를 정점에 구워 넣으므로 모양은 그대로다
 * 반환: 합쳐서 없어진 메시 수
 */
export function mergeStatic(group: THREE.Group, keep: Set<THREE.Object3D>): number {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const buckets = new Map<string, THREE.Mesh[]>();

  const visit = (o: THREE.Object3D) => {
    if (keep.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !Array.isArray(m.material) && (!m.material.transparent || m.material.userData.mergeable === true)) {
      const key = `${m.material.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.layers.mask}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(m);
    }
    for (const c of o.children) visit(c);
  };
  for (const c of group.children) visit(c);

  let removed = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      // 인덱스 있는 도형과 없는 도형이 섞이면 합칠 수 없어 모두 인덱스 없이 맞춘다
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue; // 속성이 맞지 않으면 그대로 둔다
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.layers.mask = first.layers.mask;
    mesh.name = 'merged';
    group.add(mesh);
    for (const m of list) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    removed += list.length - 1;
  }
  return removed;
}
