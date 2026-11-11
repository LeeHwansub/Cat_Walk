import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, CONTACT_QUESTION, CONTACT_TOPICS, mailtoUrl } from '../src/info/contact';
import { CREDITS } from '../src/info/credits';
import { renderInfoPage } from '../src/info/render';

describe('문의하기', () => {
  it('문의처는 dyfrkfl1@gmail.com', () => {
    expect(CONTACT_EMAIL).toBe('dyfrkfl1@gmail.com');
  });

  it('검은 고양이가 먼저 묻는다', () => {
    expect(CONTACT_QUESTION).toBe('무엇을 문의하러 오셨냐옹?');
  });

  it('문의 유형을 고를 수 있다 (버그·제안·출처·기타)', () => {
    expect(CONTACT_TOPICS.map((t) => t.id)).toEqual(['bug', 'idea', 'credit', 'etc']);
    for (const t of CONTACT_TOPICS) expect(t.label).toBeTruthy();
  });

  it('메일 쓰기 주소: 받는 사람, 유형이 담긴 제목, 본문 안내가 들어간다 (한글은 인코딩)', () => {
    const t = CONTACT_TOPICS[0];
    const url = mailtoUrl(t);
    expect(url.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('subject')).toContain('[Cat Walk]');
    expect(q.get('subject')).toContain(t.label);
    expect(q.get('body')).toBeTruthy();
    expect(url).not.toMatch(/[가-힣 ]/); // 공백·한글이 그대로 들어가지 않음
  });

  it('정보 페이지에는 메일 주소 대신 문의하기 버튼이 있다', () => {
    const html = renderInfoPage();
    expect(html).toContain('id="btn-contact"');
    expect(html).not.toContain(CONTACT_EMAIL);
  });

  it('문의 창 검은 고양이 모델도 출처에 기록한다', () => {
    const c = CREDITS.find((x) => x.id === 'black-cat')!;
    expect(c.name).toBe('Black Cat');
    expect(c.author.name).toBe('Kinga Kroliczek');
    expect(c.sourceUrl).toBe('https://sketchfab.com/3d-models/black-cat-4e001843d9774d7eb5e48d59f2bf14f5');
  });
});
