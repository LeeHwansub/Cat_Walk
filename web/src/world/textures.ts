import * as THREE from 'three';
import { createRng } from '../core/rng';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 아스팔트: 회색 바탕에 잔자갈 점 */
export function asphaltTexture(): THREE.CanvasTexture {
  const rng = createRng(11);
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#5f5f62';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = 70 + Math.floor(rng() * 70);
      g.fillStyle = `rgb(${v},${v},${v + 3})`;
      g.fillRect(rng() * 256, rng() * 256, 1 + rng() * 1.5, 1 + rng() * 1.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 잔디: 초록 바탕에 짧은 결 */
export function grassTexture(): THREE.CanvasTexture {
  const rng = createRng(5);
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#6f9a4a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3500; i++) {
      const gg = 120 + Math.floor(rng() * 60);
      g.strokeStyle = `rgba(${60 + rng() * 40},${gg},${50 + rng() * 30},0.8)`;
      const x = rng() * 256;
      const y = rng() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 3, y - 2 - rng() * 4);
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 건물 외벽: 바탕색 + 창문 격자 (한 장 = 가로 3m, 세로 3m 한 층) */
export function facadeTexture(base: string, frame = '#e9e4da'): THREE.CanvasTexture {
  const t = canvasTexture(128, 128, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = frame;
    g.fillRect(28, 34, 72, 50);
    g.fillStyle = '#4f6070';
    g.fillRect(32, 38, 30, 42);
    g.fillRect(66, 38, 30, 42);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(34, 40, 8, 38);
    g.fillRect(68, 40, 8, 38);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 124, 128, 4);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 벽돌 벽 */
export function brickTexture(base = '#9a5a45'): THREE.CanvasTexture {
  const rng = createRng(3);
  const t = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#cfc6b8';
    g.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 16 : 0;
      for (let col = -1; col < 5; col++) {
        const shade = 0.85 + rng() * 0.3;
        const c = new THREE.Color(base).multiplyScalar(shade);
        g.fillStyle = `#${c.getHexString()}`;
        g.fillRect(col * 32 + off + 1, row * 16 + 1, 30, 14);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 빗물 자국: 위는 진하고 아래로 갈수록 옅어지는 세로 줄무늬 (투명) */
export function rainStreakTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 128, (g) => {
    g.clearRect(0, 0, 64, 128);
    const rng = createRng(7);
    for (let i = 0; i < 14; i++) {
      const x = rng() * 64;
      const w = 2 + rng() * 6;
      const len = 50 + rng() * 78;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(60,55,48,0.32)');
      grad.addColorStop(1, 'rgba(60,55,48,0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, w, len);
    }
  });
}
