import { describe, expect, it } from 'vitest';

const fs = (globalThis as unknown as {
  process: { getBuiltinModule(id: string): { readFileSync(p: string, enc?: string): Uint8Array | string; statSync(p: string): { size: number } } };
}).process.getBuiltinModule('node:fs');

const html = fs.readFileSync('index.html', 'utf8') as string;

describe('인트로 화면 (썸네일 겸, 2026-11-12)', () => {
  it('영상은 가볍게: mp4 1MB 이하, 첫 장면 그림 300KB 이하 (원본 webp 7.2MB 대신)', () => {
    expect(fs.statSync('public/assets/intro/intro.mp4').size).toBeLessThan(1024 * 1024);
    expect(fs.statSync('public/assets/intro/intro-poster.jpg').size).toBeLessThan(300 * 1024);
  });

  it('시작 화면에 소리 없이 반복되는 영상과 "눌러서 시작" 안내가 있다', () => {
    const video = html.match(/<video[^>]*class="intro-video"[^>]*>/)?.[0] ?? '';
    for (const attr of ['autoplay', 'muted', 'loop', 'playsinline', 'intro.mp4', 'intro-poster.jpg']) expect(video).toContain(attr);
    expect(html).toContain('class="intro-tap"');
  });

  it('링크 미리보기 썸네일(og:image)은 첫 장면 그림, 절대 주소', () => {
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/assets\/intro\/intro-poster\.jpg"/);
  });
});
