import * as THREE from 'three';

/**
 * 눈 얹기 (크리스마스 보드 X-04·X-06, 2026-11-16): 위를 보는 면만 하얗게 덮는다.
 * 기존 소나무·벤치·그루터기를 그대로 겨울 소품으로 쓴다. 원본 재질은 다른 맵도 쓰므로 건드리지 않고 복제해서 쓴다
 */
const cache = new Map<THREE.Material, THREE.Material>();
const SNOW = new THREE.Color('#eef2f9');

export function snowCovered<T extends THREE.Material | THREE.Material[]>(mat: T): T {
  if (Array.isArray(mat)) return mat.map((m) => snowCovered(m)) as T;
  const src = mat as THREE.Material;
  let out = cache.get(src);
  if (!out) {
    out = src.clone();
    out.userData = { ...src.userData, snowy: true };
    out.onBeforeCompile = (shader) => {
      shader.uniforms.uSnow = { value: SNOW };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vec3 snowN = objectNormal;
          #ifdef USE_INSTANCING
            snowN = mat3(instanceMatrix) * snowN;
          #endif
          vSnowUp = normalize(mat3(modelMatrix) * snowN).y;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSnowUp;\nuniform vec3 uSnow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uSnow, smoothstep(0.2, 0.5, vSnowUp));');
    };
    out.customProgramCacheKey = () => 'snow-cover';
    cache.set(src, out);
  }
  return out as T;
}
