import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** 고양이 기준 모델 (사용자 제공 캐릭터.glb, docs/ASSETS.md 6장) */
export const CAT_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/cat.glb`;

/** 달리기 동작 원본 (_box/blender/motion/Run.blend의 뼈대·동작만 내보냄, docs/ASSETS.md 6.2) */
export const CAT_RUN_URL = `${import.meta.env.BASE_URL}assets/models/cat-run.glb`;

/** glb를 불러와 장면(뼈대 + 메시)을 돌려준다 */
export async function loadCatModel(url = CAT_MODEL_URL): Promise<THREE.Object3D> {
  const gltf = await new GLTFLoader().loadAsync(url);
  // 동작 클립(걷기)은 장면에 붙여 넘긴다
  gltf.scene.animations = gltf.animations;
  return gltf.scene;
}

/** 그루밍 동작 원본 (_box/blender/motion/grumming.glb의 뼈대·동작만 내보냄, CREDITS.md) */
export const CAT_GROOM_URL = `${import.meta.env.BASE_URL}assets/models/cat-groom.glb`;
/** 누운 자세 (배 보이기·옆으로 눕기). Blender로 cat.glb 뼈대에 잡은 자세, 뼈대·자세만 (D-44) */
export const CAT_POSES_URL = `${import.meta.env.BASE_URL}assets/models/cat-poses.glb`;

/** 동작 파일을 불러온다. 실패하면 null (그 동작은 코드 동작으로 대신) */
export async function loadMotion(url: string): Promise<THREE.Object3D | null> {
  try {
    return await loadCatModel(url);
  } catch (err) {
    console.error('동작 파일을 불러오지 못했습니다', url, err);
    return null;
  }
}

/** 달리기 동작을 불러온다. 실패하면 null (달리기는 걷기 동작으로 대신) */
export async function loadRunMotion(url = CAT_RUN_URL): Promise<THREE.Object3D | null> {
  try {
    return await loadCatModel(url);
  } catch (err) {
    console.error('달리기 동작을 불러오지 못했습니다', err);
    return null;
  }
}
