import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
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
