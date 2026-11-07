import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** 문의 창의 검은 고양이 (Black Cat, Kinga Kroliczek, CC BY 4.0 — CREDITS.md) */
export const BLACK_CAT_URL = `${import.meta.env.BASE_URL}assets/models/black-cat.glb`;

/**
 * 작은 캔버스에 검은 고양이를 띄운다. 뼈대가 없는 정지 모델이라
 * 몸 전체를 숨 쉬듯 늘였다 줄이고, 좌우로 살랑 돌린다. 고르면 한 번 콩 뛴다.
 */
export class BlackCatView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly holder = new THREE.Group();
  private readonly clock = new THREE.Clock();
  private raf = 0;
  private hopAt = -10;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reduceMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight('#fff6ec', '#8a7f78', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1.5, 2.5, 3);
    this.scene.add(key);
    // 검은 털이 배경에 묻히지 않게 뒤쪽 테두리 빛
    const rim = new THREE.DirectionalLight('#ffd9b0', 1.4);
    rim.position.set(-2, 1.5, -2.5);
    this.scene.add(rim);
    this.scene.add(this.holder);
    this.camera.position.set(0, 0.9, 3.5);
    this.camera.lookAt(0, 0.68, 0);
    this.resize();
  }

  /** 모델을 불러와 그리기 시작한다. 실패하면 false */
  async start(url = BLACK_CAT_URL): Promise<boolean> {
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      if (this.disposed) return false;
      const cat = gltf.scene;
      // 바닥 가운데에 세운다 (모델 높이 약 1.5)
      const box = new THREE.Box3().setFromObject(cat);
      const center = box.getCenter(new THREE.Vector3());
      cat.position.set(-center.x, -box.min.y, -center.z);
      this.holder.add(cat);
    } catch (err) {
      console.error('검은 고양이 모델을 불러오지 못했습니다', err);
      return false;
    }
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(this.clock.getElapsedTime());
    };
    loop();
    return true;
  }

  /** 고르면 한 번 콩 뛴다 */
  hop(): void {
    this.hopAt = this.clock.getElapsedTime();
  }

  private frame(t: number): void {
    if (this.reduceMotion) {
      this.holder.rotation.y = 0.25;
    } else {
      const breathe = Math.sin(t * 2.4) * 0.018;
      this.holder.scale.set(1 + breathe * 0.5, 1 - breathe, 1 + breathe * 0.5);
      this.holder.rotation.y = 0.25 + Math.sin(t * 0.8) * 0.28;
      this.holder.rotation.z = Math.sin(t * 1.1) * 0.03;
      const h = t - this.hopAt;
      this.holder.position.y = h >= 0 && h < 0.35 ? Math.sin((h / 0.35) * Math.PI) * 0.18 : 0;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 200;
    const h = this.canvas.clientHeight || 200;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
