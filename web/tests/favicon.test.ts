import { describe, expect, it } from 'vitest';

const fs = (globalThis as unknown as {
  process: { getBuiltinModule(id: string): { readFileSync(p: string, enc?: string): string | Uint8Array; existsSync(p: string): boolean } };
}).process.getBuiltinModule('node:fs');

// 파비콘: 고양이 발자국 (사용자 선택 2026-11-12, 1안: 바탕 없는 주황 발자국)
describe('파비콘', () => {
  it('아이콘 파일이 있다 (SVG, 32px PNG, 휴대폰 홈 화면 180px)', () => {
    for (const f of ['public/favicon.svg', 'public/favicon-32.png', 'public/apple-touch-icon.png']) expect(fs.existsSync(f), f).toBe(true);
    const svg = fs.readFileSync('public/favicon.svg', 'utf8') as string;
    expect(svg).toContain('<svg');
    expect(svg).toContain('#d9824a'); // 게임 강조색
  });

  it('게임 화면과 정보 페이지 모두 아이콘을 연결한다 (빈 아이콘 data:, 는 없앤다)', () => {
    for (const page of ['index.html', 'info.html']) {
      const html = fs.readFileSync(page, 'utf8') as string;
      const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
      expect(head, page).toContain('<link rel="icon" href="./favicon.svg" type="image/svg+xml" />');
      expect(head, page).toContain('<link rel="icon" href="./favicon-32.png" sizes="32x32" type="image/png" />');
      expect(head, page).toContain('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />');
      expect(head, page).not.toContain('href="data:,"');
    }
  });
});
