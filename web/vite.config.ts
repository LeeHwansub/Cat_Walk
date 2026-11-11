import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // 개발 중 멀티플레이: /api는 로컬 방 서버(npm run dev:server, wrangler dev 8787)로 넘긴다
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
  build: {
    // 게임(index.html)과 정보 페이지(info.html: 이용 방법·개인정보 처리방침·출처)
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        info: resolve(import.meta.dirname, 'info.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
