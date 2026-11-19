import * as THREE from 'three';
import { DEFAULT_LIGHTING, type Lighting, type MapLight } from './lighting';

/** 실제 점조명 수 (휴대폰 부담 때문에 보드 X-06대로 8개까지, 나머지는 빛 번짐만) */
const MAX_POINT_LIGHTS = 8;

/**
 * 렌더러, 장면, 조명. 시간대(낮·저녁·밤)마다 조명 묶음을 바꿔 끼운다 (applyLighting, 2026-11-16).
 * 낮의 공통 묶음은 원래의 강한 오후 햇빛과 짙은 그림자 그대로다
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sky: THREE.Mesh;
  /** 어두울 때 고양이 주변 보조광 */
  private readonly fill = new THREE.PointLight('#ffe2c0', 0, 6, 1.6);
  private sunOffset = new THREE.Vector3(9, 15, 6);
  private lighting: Lighting = DEFAULT_LIGHTING.day;
  private readonly lampGroup = new THREE.Group();
  private lamps: { light: THREE.PointLight; base: number }[] = [];
  private halos: THREE.Points | null = null;
  /** 시간대에 맞춰 밝기를 바꿀 맵 (빛나는 재질) */
  private mapRoot: THREE.Object3D | null = null;
  /** 맵 밖에서 함께 밝기를 맞출 것 (주민: 루돌프 코) */
  private glowExtras: THREE.Object3D[] = [];

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

    this.scene.background = new THREE.Color('#cfe2ee');
    this.scene.fog = new THREE.Fog('#cfe2ee', 30, 95);

    // 하늘: 안쪽을 보는 큰 공에 정점 색 그라데이션 (꼭대기 → 지평선). 안개를 받지 않는다
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight('#e2eef7', '#8a7d6c', 1.15);
    this.scene.add(this.hemi);
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
    this.fill.visible = false;
    this.scene.add(this.fill, this.lampGroup);
    this.applyLighting(DEFAULT_LIGHTING.day);
  }

  /** 시간대 조명 묶음을 적용한다: 하늘·반구광·해(달)·안개·노출·빛나는 재질·맵 불빛·보조광 */
  applyLighting(l: Lighting): void {
    this.lighting = l;
    paintSky(this.sky.geometry, l.sky);
    (this.scene.background as THREE.Color).set(l.fog.color);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(l.fog.color);
    fog.near = l.fog.near;
    fog.far = l.fog.far;
    this.hemi.color.set(l.hemi[0]);
    this.hemi.groundColor.set(l.hemi[1]);
    this.hemi.intensity = l.hemi[2];
    this.sun.color.set(l.sun.color);
    this.sun.intensity = l.sun.intensity;
    this.sunOffset.set(...l.sun.offset);
    this.renderer.toneMappingExposure = l.exposure;
    this.fill.intensity = l.fill;
    this.fill.visible = l.fill > 0;
    for (const p of this.lamps) {
      p.light.intensity = p.base * l.lamps;
      p.light.visible = l.lamps > 0;
    }
    if (this.halos) {
      this.halos.visible = l.lamps > 0;
      (this.halos.material as THREE.PointsMaterial).opacity = Math.min(1, 0.7 * l.lamps);
    }
    this.applyGlow();
  }

  /**
   * 맵을 바꿀 때: 그 맵의 불빛 자리로 점조명(앞의 8개)과 빛 번짐을 새로 놓고, 빛나는 재질 밝기를 맞출 맵을 기억한다
   */
  setMap(root: THREE.Object3D, lights: readonly MapLight[]): void {
    this.mapRoot = root;
    for (const p of this.lamps) p.light.dispose();
    this.lampGroup.clear();
    this.lamps = [];
    if (this.halos) {
      this.halos.geometry.dispose();
      (this.halos.material as THREE.Material).dispose();
      this.halos = null;
    }
    for (const m of lights.filter((m) => m.light !== false).slice(0, MAX_POINT_LIGHTS)) {
      const light = new THREE.PointLight(m.color ?? '#ffd27a', 0, 9, 1.8);
      light.position.set(m.x, m.y, m.z);
      this.lampGroup.add(light);
      this.lamps.push({ light, base: 6 });
    }
    if (lights.length > 0) this.halos = haloPoints(lights);
    if (this.halos) this.lampGroup.add(this.halos);
    this.applyLighting(this.lighting);
  }

  /** 그림자는 고양이 주변만 비추면 되므로, 그림자 카메라가 고양이를 따라가며 선명함을 유지한다. 보조광도 고양이를 따라간다 */
  followSun(x: number, z: number): void {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunOffset.x, this.sunOffset.y, z + this.sunOffset.z);
    this.fill.position.set(x, 1.6, z + 0.6);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  /** 맵에 속하지 않지만 빛나는 재질이 있는 것 (주민). 맵을 바꿀 때마다 새로 준다 */
  setGlowExtras(roots: THREE.Object3D[]): void {
    this.glowExtras = roots;
    this.applyGlow();
  }

  /** 빛나는 재질(bakeModel이 만든 glow, 전구 줄)의 밝기: 낮에는 꺼진 듯 약하게, 밤에는 또렷하게 */
  private applyGlow(): void {
    const g = Math.min(1, this.lighting.glow);
    for (const root of [this.mapRoot, ...this.glowExtras]) if (root) setGlowBrightness(root, g);
  }
}

/** root 아래 glow 재질의 밝기를 g(0~1)로 */
function setGlowBrightness(root: THREE.Object3D, g: number): void {
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial && m.name === 'glow') (m as THREE.MeshBasicMaterial).color.setScalar(g);
    }
  });
}

/** 하늘 공의 정점에 높이에 따라 색을 칠한다 (stops: 꼭대기 → 지평선, 지평선 아래는 마지막 색) */
function paintSky(geo: THREE.BufferGeometry, stops: string[]): void {
  const pos = geo.getAttribute('position');
  let col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!col) {
    col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', col);
  }
  const cs = stops.map((s) => new THREE.Color(s));
  const c = new THREE.Color();
  const r = (geo as THREE.SphereGeometry).parameters?.radius ?? 200;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / r); // 0 지평선 … 1 꼭대기
    const f = (1 - Math.pow(t, 0.6)) * (cs.length - 1); // 지평선 쪽 색이 넓게
    const k = Math.min(cs.length - 2, Math.floor(f));
    c.copy(cs[k]).lerp(cs[k + 1] ?? cs[k], f - k);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

/** 불빛 자리마다 둥근 빛 번짐 (점 하나로 그린다, 더하기 합성) */
function haloPoints(lights: readonly MapLight[]): THREE.Points {
  const pos = new Float32Array(lights.length * 3);
  const col = new Float32Array(lights.length * 3);
  const c = new THREE.Color();
  lights.forEach((m, i) => {
    pos.set([m.x, m.y, m.z], i * 3);
    c.set(m.color ?? '#ffd27a');
    col.set([c.r, c.g, c.b], i * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const a = Math.pow(Math.max(0, 1 - d), 2.2);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.needsUpdate = true;
  const size = 2.6; // 콘셉트 그림처럼 크게 퍼지는 둥근 빛
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false, toneMapped: false }));
  pts.name = 'lampHalos';
  pts.frustumCulled = false;
  return pts;
}
