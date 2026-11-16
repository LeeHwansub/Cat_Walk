import * as THREE from 'three';
import { createRng, range } from '../core/rng';
import type { Weather } from './weather';

/** 빗줄기·눈송이를 흩뿌리는 상자 (고양이를 가운데에 두고 따라간다, m) */
export const RAIN_BOX = { w: 30, d: 30, h: 12 };
export const SNOW_BOX = { w: 40, d: 40, h: 14 };
const RAIN_N = 1500;
const SNOW_N = 1400;
const RAIN_LEN = 0.45;

/**
 * 비·눈 입자 (날씨, 2026-11-16). 맵이 아니라 장면에 한 번만 붙이고 고양이를 따라다닌다: 맵을 바꿔도 다시 만들지 않는다.
 * 상자 밖으로 벗어난 입자는 반대편으로 돌린다 (고양이가 멀리 가도 둘레에만 그린다). 비·눈 모두 그리기 1회씩.
 * 눈은 예전 눈 오는 광장의 눈 내리기(xmas.ts snowfall)를 옮긴 것이다
 */
export class Precipitation {
  readonly group = new THREE.Group();
  readonly rain: THREE.LineSegments;
  readonly snow: THREE.Points;
  private readonly rainSpeed = new Float32Array(RAIN_N);
  private readonly snowSpeed = new Float32Array(SNOW_N);
  private readonly snowPhase = new Float32Array(SNOW_N);
  private t = 0;

  constructor() {
    const rng = createRng(6262);
    // 빗줄기: 점 2개(위·아래)로 된 짧은 선
    const rp = new Float32Array(RAIN_N * 6);
    for (let i = 0; i < RAIN_N; i++) {
      const x = (rng() - 0.5) * RAIN_BOX.w;
      const y = rng() * RAIN_BOX.h;
      const z = (rng() - 0.5) * RAIN_BOX.d;
      rp.set([x, y, z, x, y - RAIN_LEN, z], i * 6);
      this.rainSpeed[i] = range(rng, 11, 15);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b9c6d6', transparent: true, opacity: 0.45, depthWrite: false }));
    this.rain.name = 'rainfall';

    const sp = new Float32Array(SNOW_N * 3);
    for (let i = 0; i < SNOW_N; i++) {
      sp.set([(rng() - 0.5) * SNOW_BOX.w, rng() * SNOW_BOX.h, (rng() - 0.5) * SNOW_BOX.d], i * 3);
      this.snowSpeed[i] = range(rng, 0.6, 1.3);
      this.snowPhase[i] = rng() * Math.PI * 2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: '#ffffff', map: flakeTexture(), size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.snow.name = 'snowfall';

    for (const o of [this.rain, this.snow]) {
      o.frustumCulled = false; // 입자가 움직여 경계 구를 다시 계산하지 않는다. 늘 카메라 둘레에 있다
      o.visible = false;
      this.group.add(o);
    }
  }

  setKind(w: Weather): void {
    this.rain.visible = w === 'rain';
    this.snow.visible = w === 'snow';
  }

  /** cx, cz: 고양이 위치 (상자 가운데) */
  update(dt: number, cx: number, cz: number): void {
    this.t += dt;
    if (this.rain.visible) this.updateRain(dt, cx, cz);
    if (this.snow.visible) this.updateSnow(dt, cx, cz);
  }

  private updateRain(dt: number, cx: number, cz: number): void {
    const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const { w, d, h } = RAIN_BOX;
    for (let i = 0; i < RAIN_N; i++) {
      const o = i * 6;
      let y = p[o + 1] - this.rainSpeed[i] * dt;
      if (y < 0) y += h;
      const x = wrap(p[o], cx, w);
      const z = wrap(p[o + 2], cz, d);
      p[o] = p[o + 3] = x;
      p[o + 2] = p[o + 5] = z;
      p[o + 1] = y;
      p[o + 4] = y - RAIN_LEN;
    }
    attr.needsUpdate = true;
  }

  private updateSnow(dt: number, cx: number, cz: number): void {
    const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const { w, d, h } = SNOW_BOX;
    for (let i = 0; i < SNOW_N; i++) {
      const o = i * 3;
      let y = p[o + 1] - this.snowSpeed[i] * dt;
      if (y < 0) y += h;
      p[o + 1] = y;
      p[o] = wrap(p[o] + Math.sin(this.t * 0.8 + this.snowPhase[i]) * 0.15 * dt, cx, w);
      p[o + 2] = wrap(p[o + 2], cz, d);
    }
    attr.needsUpdate = true;
  }
}

/** v를 c 둘레 폭 size 안으로 돌린다 (밖으로 나가면 반대편에서 들어온다) */
function wrap(v: number, c: number, size: number): number {
  const half = size / 2;
  const r = (((v - c + half) % size) + size) % size;
  return c - half + r;
}

/** 둥근 눈송이 그림 (가운데가 진하고 가장자리가 흐린 원). 점은 기본이 네모라 가까이 오면 네모가 보인다. 캔버스 없이 만든다 */
function flakeTexture(): THREE.DataTexture {
  const n = 32;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dd = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const a = Math.max(0, Math.min(1, (1 - dd) * 2.2));
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}
