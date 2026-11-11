import { describe, expect, it } from 'vitest';
// 프로젝트 루트 CREDITS.md를 글자 그대로 읽는다 (Vite ?raw)
import creditsMd from '../../CREDITS.md?raw';
import { CREDITS } from '../src/info/credits';
import { escapeHtml, renderCredits, renderInfoPage } from '../src/info/render';


describe('출처 데이터 (CREDITS)', () => {
  it('고양이 모델, 달리기 동작, 효과음이 모두 있다', () => {
    const ids = CREDITS.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['toon-cat', 'run-cat', 'meow-sounds']));
  });

  it('항목마다 이름·제작자·원본 URL·다운로드 URL·라이선스·사용 파일이 있다', () => {
    for (const c of CREDITS) {
      expect(c.name, c.id).toBeTruthy();
      expect(c.author.name, c.id).toBeTruthy();
      expect(c.sourceUrl, c.id).toMatch(/^https:\/\//);
      expect(c.downloadUrl, c.id).toMatch(/^https:\/\//);
      expect(c.license.name, c.id).toBeTruthy();
      expect(c.files.length, c.id).toBeGreaterThan(0);
    }
  });

  it('고양이 모델 출처: Toon Cat FREE(Omabuarts Studio)와 Lowpoly Cat Rig + Run Animation(Daily Lowpoly)', () => {
    const toon = CREDITS.find((c) => c.id === 'toon-cat')!;
    expect(toon.author.name).toBe('Omabuarts Studio');
    expect(toon.sourceUrl).toBe('https://sketchfab.com/3d-models/toon-cat-free-b2bd1ee7858444bda366110a2d960386');
    const run = CREDITS.find((c) => c.id === 'run-cat')!;
    expect(run.author.name).toBe('Daily Lowpoly');
    expect(run.sourceUrl).toBe('https://sketchfab.com/3d-models/lowpoly-cat-rig-run-animation-c36df576c9ae4ed28e89069b1a2f427a');
    expect(run.downloadUrl).toBe('https://free3d.com/3d-model/lowpoly-cat-rigged-run-animation-756268.html');
  });

  it('수정·변환한 에셋은 수정 내역이 있다', () => {
    for (const id of ['toon-cat', 'run-cat', 'meow-sounds']) {
      expect(CREDITS.find((c) => c.id === id)!.changes.length, id).toBeGreaterThan(0);
    }
  });

  it('상업적 배포 가능하다고 표시하지 않는다 (사용 권한 확인 전)', () => {
    for (const c of CREDITS) expect(c.commercial, c.id).toBe('unconfirmed');
    const html = renderInfoPage();
    expect(html).not.toMatch(/상업적 (이용|사용|배포)[^<]{0,10}가능(?!\s*여부)/);
    expect(creditsMd).not.toMatch(/상업적 (이용|사용|배포)[^\n]{0,10}가능(?!\s*여부)/);
  });
});

describe('정보 페이지', () => {
  it('개인정보 처리방침·이용 방법·출처 세 부분이 있다', () => {
    const html = renderInfoPage();
    expect(html).toContain('id="privacy"');
    expect(html).toContain('id="howto"');
    expect(html).toContain('id="credits"');
  });

  it('출처 부분에 모델마다 제작자·원본 링크·라이선스가 보인다', () => {
    const html = renderCredits(CREDITS);
    for (const c of CREDITS) {
      expect(html).toContain(escapeHtml(c.author.name));
      expect(html).toContain(`href="${c.sourceUrl}"`);
      expect(html).toContain(escapeHtml(c.license.name));
    }
  });

  it('외부 링크는 새 탭에서 열리고 opener를 넘기지 않는다', () => {
    const html = renderCredits(CREDITS);
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a).toContain('rel="noopener noreferrer"');
  });

  it('글자는 HTML로 해석되지 않게 바꾼다', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('CREDITS.md (프로젝트 루트)', () => {
  it('출처 데이터와 같은 내용을 담고 있다 (제작자·URL·라이선스)', () => {
    for (const c of CREDITS) {
      expect(creditsMd, c.id).toContain(c.author.name);
      expect(creditsMd, c.id).toContain(c.sourceUrl);
      expect(creditsMd, c.id).toContain(c.downloadUrl);
      expect(creditsMd, c.id).toContain(c.license.name);
    }
  });
});
