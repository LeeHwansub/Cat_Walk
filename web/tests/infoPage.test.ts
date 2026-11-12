import { describe, expect, it } from 'vitest';
import { INFO_EFFECTIVE_DATE } from '../src/info/credits';
import { renderInfoPage } from '../src/info/render';

describe('정보 페이지 이용 방법 (2026-11-12 갱신)', () => {
  const page = renderInfoPage();

  it('페이지 시행일이 개인정보 처리방침 시행일과 같다', () => {
    expect(INFO_EFFECTIVE_DATE).toBe('2026-11-12');
    expect(page).toContain('시행일: 2026년 11월 12일');
  });

  it('인트로·포즈·지도·맵·휴대폰 조작을 안내한다', () => {
    expect(page).toContain('화면을 눌러 시작');
    expect(page).toContain('<kbd>P</kbd>');
    expect(page).toContain('<kbd>M</kbd>');
    for (const name of ['골목과 공원', '들판', '농장']) expect(page).toContain(name);
    expect(page).toContain('조이스틱');
    expect(page).toContain('점프 버튼');
  });
});
