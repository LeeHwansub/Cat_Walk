import { describe, expect, it } from 'vitest';
import { bodyNearCut, createCatSkinUniforms } from '../src/cat/catSkin';

/** 2026-11-07 측정 (성체, 달리는 중, 1인칭): 화면을 가리던 목·어깨 정점은 카메라에서 약 5.6cm, 앞발은 약 25cm */
const INTRUDING = 0.056;
const PAW = 0.25;

describe('카메라 바로 앞 몸 표면 숨김', () => {
  it('1인칭: 가리던 목·어깨는 숨기고 앞발은 보인다', () => {
    const cut = bodyNearCut(true, 1);
    // 서서히 사라지는 구간(cut*0.75 ~ cut)보다 가까우면 완전히 숨김
    expect(cut * 0.75).toBeGreaterThan(INTRUDING);
    expect(cut).toBeLessThan(PAW * 0.5);
  });

  it('3인칭에서는 표면을 뚫지 않는다 (가까우면 몸 전체를 흐리게: bodyFade)', () => {
    expect(bodyNearCut(false, 1)).toBe(0);
  });

  it('고양이 크기에 비례한다 (아기 고양이는 더 짧게)', () => {
    expect(bodyNearCut(true, 0.6)).toBeCloseTo(bodyNearCut(true, 1) * 0.6, 6);
  });

  it('셰이더 값의 기본은 0 (숨기지 않음)', () => {
    expect(createCatSkinUniforms().uNearCut.value).toBe(0);
  });
});
