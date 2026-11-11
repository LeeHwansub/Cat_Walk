import * as THREE from 'three';
import { createRng } from '../core/rng';

/** 한 부위에 덧씌울 수 있는 최대 털 겹 수 (품질 high) */
export const MAX_SHELLS = 10;

interface ShellMat {
  mat: THREE.MeshStandardMaterial;
  src: THREE.MeshStandardMaterial;
  len: { value: number };
}

/**
 * Shell fur: 몸 부위 위에 같은 모양을 노멀 방향으로 조금씩 부풀린 겹을 여러 장 덧씌우고,
 * 털 가닥 노이즈로 바깥 겹일수록 듬성듬성 지워 털 끝이 가늘어지게 한다.
 * - 부위마다 겹을 InstancedMesh 하나로 그려 그리기 호출을 부위당 1번으로 줄인다 (겹 번호 = gl_InstanceID)
 * - 머리·볼은 털을 짧게 해서 눈·주둥이를 덮지 않게 한다 (부위별 길이 배율)
 * - 겹은 원본 부위의 자식이라 체형·크기·자세 변화를 그대로 따른다
 */
export class FurShells {
  private readonly entries: { src: THREE.Mesh; shell: THREE.InstancedMesh; factor: number }[] = [];
  private readonly mats = new Map<string, ShellMat>();
  private readonly shells = { value: 0 };
  private readonly noise = strandNoise(THREE.NearestFilter);
  /** 겹이 없을 때(품질 low)도 털결이 보이게 하는 요철 텍스처 */
  readonly bump = strandNoise(THREE.LinearFilter);
  private length = 0.006;
  private count = 0;

  constructor() {
    this.bump.repeat.set(6, 3);
  }

  /** 털을 씌울 부위를 등록한다. factor: 털 길이 배율 */
  add(src: THREE.Mesh, factor = 1): void {
    const shell = new THREE.InstancedMesh(src.geometry, this.matFor(src.material as THREE.MeshStandardMaterial, factor).mat, MAX_SHELLS);
    shell.count = this.count;
    shell.visible = this.count > 0;
    shell.castShadow = false;
    shell.receiveShadow = true;
    shell.frustumCulled = false;
    shell.layers.mask = src.layers.mask;
    src.add(shell);
    this.entries.push({ src, shell, factor });
  }

  /** 겹 수 (0이면 겹 없이 요철 텍스처만) */
  setCount(n: number): void {
    this.count = Math.max(0, Math.min(MAX_SHELLS, Math.round(n)));
    this.shells.value = this.count;
    for (const e of this.entries) {
      e.shell.count = this.count;
      e.shell.visible = this.count > 0;
    }
  }

  setLength(len: number): void {
    this.length = len;
    for (const m of this.mats.values()) m.len.value = len * this.factorOf(m);
  }

  /** 원본 재질(색·무늬)이 바뀐 뒤 호출: 겹 재질을 맞추고, 바뀐 재질(꼬리 끝 등)을 다시 연결한다 */
  sync(): void {
    for (const e of this.entries) {
      e.shell.material = this.matFor(e.src.material as THREE.MeshStandardMaterial, e.factor).mat;
      e.shell.layers.mask = e.src.layers.mask;
    }
    for (const m of this.mats.values()) {
      const hadMap = m.mat.map !== null;
      m.mat.color.copy(m.src.color);
      m.mat.map = m.src.map;
      if (hadMap !== (m.mat.map !== null)) m.mat.needsUpdate = true;
    }
  }

  private factors = new WeakMap<ShellMat, number>();
  private factorOf(m: ShellMat): number {
    return this.factors.get(m) ?? 1;
  }

  private matFor(src: THREE.MeshStandardMaterial, factor: number): ShellMat {
    const key = `${src.uuid}|${factor}`;
    const found = this.mats.get(key);
    if (found) return found;
    const len = { value: this.length * factor };
    const mat = new THREE.MeshStandardMaterial({ color: src.color.clone(), map: src.map, roughness: 1, metalness: 0 });
    mat.defines = { USE_UV: '' };
    const noise = this.noise;
    const shells = this.shells;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.furLen = len;
      shader.uniforms.furShells = shells;
      shader.uniforms.furNoise = { value: noise };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float furLen;\nuniform float furShells;\nvarying float vFurLayer;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvFurLayer = (float(gl_InstanceID) + 1.0) / max(furShells, 1.0);\ntransformed += normalize(objectNormal) * furLen * vFurLayer;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D furNoise;\nvarying float vFurLayer;')
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            // 가닥 하나마다 0~1 길이를 가진다. 이 겹 높이보다 짧은 가닥은 지운다 → 끝으로 갈수록 듬성
            'float furStrand = texture2D(furNoise, vUv * vec2(6.0, 3.0)).r;',
            'if (furStrand < vFurLayer * 0.92 + 0.04) discard;',
            // 뿌리 쪽은 빛이 덜 닿아 어둡다
            'diffuseColor.rgb *= mix(0.62, 1.04, vFurLayer);',
          ].join('\n'),
        );
    };
    const entry: ShellMat = { mat, src, len };
    this.factors.set(entry, factor);
    this.mats.set(key, entry);
    return entry;
  }
}

/** 털 가닥 노이즈: 텍셀마다 가닥 길이(0~1) */
function strandNoise(filter: THREE.MagnificationTextureFilter): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const rng = createRng(91);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(rng() * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = filter;
  t.minFilter = filter === THREE.NearestFilter ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = filter !== THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
