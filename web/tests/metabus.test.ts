import { describe, expect, it } from 'vitest';

const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(p: string, enc: string): string } } }).process.getBuiltinModule('node:fs');
const html = fs.readFileSync('index.html', 'utf8');

// metaBus Presence SDK (사용자 요청 2026-11-12): 사이트 소유 증명 겸 접속자 수. 검증기는 JS를 실행하지 않고 HTML만 읽는다
const TAG = '<script src="https://sdk.metabus.app/presence.v1.js" data-site="mb_S924838962_5aad8b" async></script>';

describe('metaBus 태그', () => {
  it('<head> 안에 정적으로, 값을 바꾸지 않고 한 번만 있다', () => {
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    expect(head).toContain(TAG);
    expect(html.split('presence.v1.js').length - 1).toBe(1);
    const body = html.slice(html.indexOf('<body'));
    expect(body).not.toContain('metabus');
  });
});

describe('개인정보 처리방침에 metaBus 접속자 수 집계를 알린다 (2026-11-12)', () => {
  it('무엇을·어디로·왜 보내는지와 새 시행일이 있다', async () => {
    const { renderInfoPage } = await import('../src/info/render');
    const page = renderInfoPage();
    expect(page).toContain('시행일: 2026년 11월 12일');
    expect(page).toContain('metaBus');
    expect(page).toContain('api.metabus.app');
    expect(page).toContain('mb_vid');
    // 사실과 달라지는 예전 문구가 남지 않는다
    expect(page).not.toContain('그 밖의 외부 서비스에는 접속하지 않습니다');
    expect(page).not.toContain('쿠키, 방문 통계·분석 도구, 광고');
  });
});
