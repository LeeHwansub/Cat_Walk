import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** 고양이 기준 모델 (사용자 제공 캐릭터.glb, docs/ASSETS.md 6장) */
export const CAT_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/cat.glb`;

/** glb를 불러와 장면(뼈대 + 메시)을 돌려준다 */
export async function loadCatModel(url = CAT_MODEL_URL): Promise<THREE.Object3D> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}
