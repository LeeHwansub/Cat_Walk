import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 맵 소품 모델 (Polyfork 무료 모델, CC BY 4.0, 2026-11-09 시범: 골목 한 구역).
 * 모델은 미터 단위·바닥 0·가운데 정렬이고, 정점 색(COLOR_0)으로 칠해져 있다.
 * 불러온 뒤 메시 하나로 구워(bakeModel) 놓을 때마다 도형·재질을 함께 쓴다 (그리기 호출 1회).
 * 배치·충돌은 모델이 없어도 같다 (MapKit.prop이 같은 크기의 상자로 대신한다).
 */
export const PROP_SPECS = {
  hatchback: { file: 'compact-hatchback.glb', scale: 1.05 }, // 4.0m → 4.2m (예전 상자 차와 같은 길이)
  keiVan: { file: 'kei-van.glb', scale: 1.05 },
  acUnit: { file: 'air-con-unit.glb', scale: 0.9 },
  shrub: { file: 'potted-shrub.glb', scale: 0.55 }, // 1.38m → 0.76m (골목 화분 크기)
  lamp: { file: 'street-lamp.glb', scale: 0.9 },
  meterBox: { file: 'meter-box.glb', scale: 0.85 },
  moped: { file: 'delivery-moped.glb', scale: 1 },
  bicycle: { file: 'city-bicycle.glb', scale: 1 },
  vending: { file: 'vending-machine.glb', scale: 0.95 },
  bin: { file: 'street-bin.glb', scale: 0.9 },
  crate: { file: 'beverage-crate.glb', scale: 1 },
  cone: { file: 'traffic-cone.glb', scale: 0.75 },
  // 공원 (Nature & Forest 키트, 2026-11-10). 나무는 놓을 때 크기를 다시 정한다 (tree의 s)
  oak: { file: 'oak-tree.glb', scale: 1 },
  maple: { file: 'maple-tree.glb', scale: 1 },
  birch: { file: 'birch-tree.glb', scale: 1 },
  bush: { file: 'round-bush.glb', scale: 1.1 },
  parkBench: { file: 'wooden-bench.glb', scale: 0.95 },
  rockS: { file: 'small-rock.glb', scale: 1.4 },
  rockM: { file: 'medium-rock.glb', scale: 0.8 },
  wildflower: { file: 'wildflower.glb', scale: 1 },
  grassTuft: { file: 'grass-tuft.glb', scale: 1.1 },
  fern: { file: 'fern-plant.glb', scale: 0.6 },
  lanternPost: { file: 'lantern-post.glb', scale: 0.9 },
  birdhouse: { file: 'birdhouse-post.glb', scale: 0.9 },
  fallenLog: { file: 'fallen-log.glb', scale: 0.7 },
  // 들판 (Nature & Forest·Countryside Railway·Insect World 키트, 2026-11-12, D-58 4단계). 나무는 놓을 때 높이를 다시 정한다
  tallPine: { file: 'tall-pine.glb', scale: 1 },
  youngPine: { file: 'young-pine.glb', scale: 1 },
  roundTree: { file: 'round-tree.glb', scale: 1 },
  stump: { file: 'tree-stump.glb', scale: 1 }, // 높이 0.48m (올라설 수 있음)
  boulder: { file: 'large-boulder.glb', scale: 0.9 }, // 2.2m × 0.66m → 2.0m × 0.6m
  fence: { file: 'wood-fence.glb', scale: 0.8 }, // 높이 1.1m → 0.88m, 폭 2m → 1.6m
  fenceGate: { file: 'wood-fence-gate.glb', scale: 0.8 },
  stile: { file: 'fence-stile.glb', scale: 0.8 },
  signpost: { file: 'trail-signpost.glb', scale: 0.8 },
  slabStone: { file: 'slab-stone.glb', scale: 0.7 },
  dirtTrail: { file: 'dirt-trail.glb', scale: 1 }, // 1.4m × 3m 흙길 조각
  picnicTable: { file: 'picnic-table.glb', scale: 1 }, // 2m × 1.6m, 윗면 0.75m
  cattail: { file: 'cattail.glb', scale: 0.7 },
  lilyPad: { file: 'lily-pad.glb', scale: 0.9 },
  buddleia: { file: 'buddleia.glb', scale: 0.45 }, // 2.4m → 1.1m 꽃덤불
  cowParsley: { file: 'cow-parsley.glb', scale: 0.6 },
  // Insect World 키트는 곤충 눈높이로 크게 만들어져 있어 실제 크기로 줄인다.
  // 들풀(Meadow Grass Plant)은 밑에 화분 흙덩이가 붙어 있어 빼고 공원 풀 포기(grassTuft)를 쓴다 (사용자 선택 2026-11-12)
  daisy: { file: 'daisy.glb', scale: 0.045 }, // 8m → 0.36m
  dandelion: { file: 'dandelion.glb', scale: 0.016 }, // 24m → 0.39m
  clover: { file: 'clover.glb', scale: 0.02 }, // 9m → 0.18m
  // 농장 (Cozy Farm 키트, 2026-11-12, D-58 5단계). 실제 크기로 만들어져 있다
  redBarn: { file: 'red-barn.glb', scale: 1.1 }, // 6.6m × 7.7m, 높이 8m
  farmhouse: { file: 'farmhouse.glb', scale: 1.1 }, // 6.6m × 5.5m
  chickenCoop: { file: 'chicken-coop.glb', scale: 0.9 }, // 2.7m
  toolShed: { file: 'tool-shed.glb', scale: 1 },
  grainSilo: { file: 'grain-silo.glb', scale: 1 }, // 지름 3m, 높이 7.3m
  windpump: { file: 'windpump.glb', scale: 1 }, // 높이 7.9m
  appleTree: { file: 'apple-tree.glb', scale: 1.3 }, // 3.4m → 4.4m
  plumTree: { file: 'plum-tree.glb', scale: 1.3 },
  berryBush: { file: 'berry-bush.glb', scale: 1 },
  hayBale: { file: 'hay-bale.glb', scale: 1.3 }, // 1.22m × 0.6m, 윗면 0.59m (쌓으면 1.18m)
  wheatCrop: { file: 'wheat-crop.glb', scale: 1.3 },
  cornCrop: { file: 'corn-crop.glb', scale: 1 },
  pumpkinCrop: { file: 'pumpkin-crop.glb', scale: 1 },
  sunflower: { file: 'sunflower.glb', scale: 1 },
  strawberryCrop: { file: 'strawberry-crop.glb', scale: 1 },
  tomatoCrop: { file: 'tomato-crop.glb', scale: 1 },
  tilledSoil: { file: 'tilled-soil.glb', scale: 1 },
  scarecrow: { file: 'scarecrow.glb', scale: 1 },
  wheelbarrow: { file: 'wheelbarrow.glb', scale: 1 },
  waterTrough: { file: 'water-trough.glb', scale: 1 }, // 테두리 윗면 0.42m
  stoneWell: { file: 'stone-well.glb', scale: 1 },
  farmGate: { file: 'farm-gate.glb', scale: 0.9 },
  farmFence: { file: 'farm-fence.glb', scale: 0.9 }, // 1.8m 조각, 윗면 0.78m
  feedSack: { file: 'feed-sack.glb', scale: 1 },
  beehive: { file: 'beehive.glb', scale: 1 },
  tractor: { file: 'tractor.glb', scale: 1 }, // 앞(+z) 보닛 1.36m는 못 오르고, 뒷바퀴 덮개 1.1m는 오른다
} as const;

export type PropId = keyof typeof PROP_SPECS;
/** 구운 소품 모델 (없는 것은 상자로 대신한다) */
export type PropModels = Partial<Record<PropId, THREE.Object3D>>;

export const PROP_DIR = 'assets/models/props/';

/**
 * 모델의 메시를 정점 색을 유지한 채 하나로 굽는다. 바닥(최저점)을 0에, 바닥에 닿는 부분의 가운데를 원점에 맞추고 scale배 한다.
 * 구역 합치기(mergeStatic)는 색 속성을 지우므로, 구운 모델은 합치기에서 뺀다 (MapKit.unmerged).
 */
export function bakeModel(src: THREE.Object3D, scale: number): THREE.Mesh {
  src.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    // 색이 없는 메시가 섞이면 합칠 수 없어 흰색을 채운다
    if (!g.getAttribute('color')) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
    geos.push(g);
    material ??= Array.isArray(m.material) ? m.material[0] : m.material;
  });
  const geo = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  // 가로·세로 원점은 바닥에 닿는 부분(아래 5%)의 가운데: 팔이 한쪽으로 뻗은 가로등도 기둥이 놓는 자리에 온다
  const pos = geo.getAttribute('position');
  const low = b.min.y + 0.05 * (b.max.y - b.min.y);
  const base = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) <= low) base.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  geo.translate(-(base.min.x + base.max.x) / 2, -b.min.y, -(base.min.z + base.max.z) / 2);
  geo.scale(scale, scale, scale);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material ?? new THREE.MeshStandardMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 가장 넓은 면적을 칠한 정점 색(차체)만 color로 바꾼 복제를 돌려준다. 유리·바퀴·등 같은 나머지 색은 그대로, 원본은 건드리지 않는다.
 * Polyfork 모델은 정점 색으로 칠해져 재질 색으로는 차체만 바꿀 수 없다 (사용자 요청 2026-11-10: 차가 모두 같은 노란색)
 */
export function recolorBody(model: THREE.Mesh, color: string): THREE.Mesh {
  const geo = model.geometry.clone();
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const key = (i: number) => `${Math.round(col.getX(i) * 64)},${Math.round(col.getY(i) * 64)},${Math.round(col.getZ(i) * 64)}`;
  // 면적으로 센다: 정점 개수로 세면 잘게 쪼개진 바퀴가 차체보다 많다 (해치백: 바퀴 726면, 차체 510면이지만 넓이는 차체 17.1 > 바퀴 5.2)
  const pos = geo.getAttribute('position');
  const area = new Map<string, number>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i + 2 < col.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1).sub(a);
    d.fromBufferAttribute(pos, i + 2).sub(a);
    area.set(key(i), (area.get(key(i)) ?? 0) + b.cross(d).length() / 2);
  }
  let body = '';
  let most = 0;
  for (const [k, n] of area) if (n > most) (most = n), (body = k);
  const c = new THREE.Color(color); // 정점 색과 같은 선형 색 공간
  for (let i = 0; i < col.count; i++) if (key(i) === body) col.setXYZ(i, c.r, c.g, c.b);
  col.needsUpdate = true;
  const m = new THREE.Mesh(geo, model.material);
  m.castShadow = model.castShadow;
  m.receiveShadow = model.receiveShadow;
  return m;
}

const ray = new THREE.Raycaster();
/** 구운 모델의 (x, z) 지점 윗면 높이. 없으면 0 (차 보닛·트렁크에 올라설 수 있는지 잴 때) */
export function topAt(model: THREE.Object3D, x: number, z: number): number {
  model.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(model, true)[0];
  return hit ? 100 - hit.distance : 0;
}

/** 소품 모델을 모두 불러와 굽는다. 하나가 실패해도 나머지는 쓴다 (실패한 것은 상자로) */
export async function loadPropModels(loader: GLTFLoader, base: string): Promise<PropModels> {
  const out: PropModels = {};
  await Promise.all(
    (Object.keys(PROP_SPECS) as PropId[]).map(async (id) => {
      try {
        const gltf = await loader.loadAsync(`${base}${PROP_DIR}${PROP_SPECS[id].file}`);
        out[id] = bakeModel(gltf.scene, PROP_SPECS[id].scale);
      } catch (err) {
        console.warn(`소품 모델을 불러오지 못해 상자로 대신합니다: ${id}`, err);
      }
    }),
  );
  return out;
}
