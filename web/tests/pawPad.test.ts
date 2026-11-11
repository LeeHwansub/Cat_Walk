import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CatAppearance } from '../src/cat/appearance';
import { applyAppearanceToUniforms, createCatSkinUniforms, pawPadColor } from '../src/cat/catSkin';

const base: CatAppearance = { furColor: '#808080', pattern: 'solid', eyeColor: '#c9a227', stage: 'adult', size: 1, build: 1, ear: 'up' };
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const isPink = (c: THREE.Color) => c.r > c.g * 1.2 && c.r > c.b * 1.2 && lum(c) > 0.3;

describe('발바닥 패드 색', () => {
  it('흰 털 고양이는 분홍 패드', () => {
    expect(isPink(pawPadColor({ ...base, furColor: '#f4f1ea' }))).toBe(true);
  });

  it('검은 털 고양이는 검정에 가까운 패드', () => {
    expect(lum(pawPadColor({ ...base, furColor: '#151515' }))).toBeLessThan(0.08);
  });

  it('발이 흰 무늬(턱시도·고등어 흰발·삼색)는 털색이 어두워도 분홍 패드', () => {
    for (const pattern of ['tuxedo', 'tabbyWhite', 'calico'] as const) {
      expect(isPink(pawPadColor({ ...base, furColor: '#151515', pattern }))).toBe(true);
    }
  });

  it('치즈 고양이는 분홍빛 패드', () => {
    expect(isPink(pawPadColor({ ...base, furColor: '#e0a050', pattern: 'cheese' }))).toBe(true);
  });

  it('고등어(줄무늬)는 회색 털이어도 밝은 분홍이 아니라 벽돌빛 패드', () => {
    const c = pawPadColor({ ...base, furColor: '#8a8580', pattern: 'mackerel' });
    expect(lum(c)).toBeLessThan(0.12);
    expect(c.r).toBeGreaterThan(c.b * 1.2);
  });

  it('털이 어두울수록 패드도 어둡다', () => {
    const light = lum(pawPadColor({ ...base, furColor: '#b0b0b0' }));
    const mid = lum(pawPadColor({ ...base, furColor: '#707070' }));
    const dark = lum(pawPadColor({ ...base, furColor: '#303030' }));
    expect(light).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(dark);
  });

  it('외형을 적용하면 셰이더 패드 색이 바뀐다', () => {
    const u = createCatSkinUniforms();
    applyAppearanceToUniforms(u, { ...base, furColor: '#f4f1ea' });
    expect(isPink(u.uPad.value)).toBe(true);
    applyAppearanceToUniforms(u, { ...base, furColor: '#151515' });
    expect(lum(u.uPad.value)).toBeLessThan(0.08);
  });
});
