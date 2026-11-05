import * as THREE from 'three';

const SKY = new THREE.Color('#cfe2ee');
const SUN_OFFSET = new THREE.Vector3(9, 15, 6);

/** 렌더러, 장면, 조명. 강한 오후 햇빛과 짙은 그림자 (참조 영상에서 가져온 시각 방향) */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly sun: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene.background = SKY;
    this.scene.fog = new THREE.Fog(SKY, 30, 95);

    this.scene.add(new THREE.HemisphereLight('#e2eef7', '#8a7d6c', 1.15));
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -14;
    s.right = 14;
    s.top = 14;
    s.bottom = -14;
    s.near = 1;
    s.far = 60;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
  }

  /** 그림자는 고양이 주변만 비추면 되므로, 그림자 카메라가 고양이를 따라가며 선명함을 유지한다 */
  followSun(x: number, z: number): void {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }
}
