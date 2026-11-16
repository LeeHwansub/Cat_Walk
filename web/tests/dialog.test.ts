import { afterEach, describe, expect, it } from 'vitest';
import { enableLightDismiss, isOutside } from '../src/ui/dialog';

const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(p: string, enc: string): string } } }).process.getBuiltinModule('node:fs');

/** 테스트용 가짜 <dialog>: 붙인 속성·이벤트를 기록하고, 닫기를 센다 */
function fakeDialog() {
  const attrs = new Map<string, string>();
  const handlers = new Map<string, (e: { clientX: number; clientY: number }) => void>();
  const d = {
    closed: 0,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    addEventListener: (t: string, h: (e: { clientX: number; clientY: number }) => void) => void handlers.set(t, h),
    getBoundingClientRect: () => ({ left: 100, right: 300, top: 100, bottom: 200 }),
    close: () => void d.closed++,
  };
  const press = (down: [number, number], up: [number, number]) => {
    handlers.get('pointerdown')?.({ clientX: down[0], clientY: down[1] });
    handlers.get('pointerup')?.({ clientX: up[0], clientY: up[1] });
  };
  return { d, attrs, handlers, press };
}

const g = globalThis as { HTMLDialogElement?: unknown };
afterEach(() => delete g.HTMLDialogElement);

describe('대화창 바깥을 눌러 닫기 (modern-web-guidance dialog, 2026-11-16)', () => {
  it('누른 점이 창 사각형 밖인지 판단한다', () => {
    const r = { left: 100, right: 300, top: 100, bottom: 200 };
    expect(isOutside(r, 50, 150)).toBe(true);
    expect(isOutside(r, 350, 150)).toBe(true);
    expect(isOutside(r, 200, 50)).toBe(true);
    expect(isOutside(r, 200, 250)).toBe(true);
    expect(isOutside(r, 200, 150)).toBe(false);
    expect(isOutside(r, 100, 100)).toBe(false); // 테두리는 안쪽
  });

  it('closedby를 지원하는 브라우저: 속성만 붙이고 직접 처리하지 않는다', () => {
    g.HTMLDialogElement = class {};
    Object.defineProperty((g.HTMLDialogElement as { prototype: object }).prototype, 'closedBy', { value: '', configurable: true });
    const { d, attrs, handlers } = fakeDialog();
    enableLightDismiss(d as unknown as HTMLDialogElement);
    expect(attrs.get('closedby')).toBe('any');
    expect(handlers.size).toBe(0);
  });

  it('지원하지 않는 브라우저(Safari): 누를 때와 뗄 때 모두 창 밖이면 닫는다 (안에서 끌어 밖에서 떼면 닫지 않음)', () => {
    g.HTMLDialogElement = class {};
    const { d, attrs, press } = fakeDialog();
    enableLightDismiss(d as unknown as HTMLDialogElement);
    expect(attrs.get('closedby')).toBe('any');
    press([150, 150], [150, 150]); // 창 안
    expect(d.closed).toBe(0);
    press([150, 150], [20, 20]); // 안에서 눌러 밖에서 뗌 (글자 선택 끌기)
    expect(d.closed).toBe(0);
    press([20, 20], [20, 20]); // 바깥(배경)
    expect(d.closed).toBe(1);
  });
});

describe('게임 화면 HTML (modern-web-guidance, 2026-11-16)', () => {
  const html = fs.readFileSync('index.html', 'utf8');

  it('설정 창은 브라우저 기본 <dialog>이고 직접 붙인 role·aria-modal이 없다', () => {
    const tag = html.match(/<dialog id="settings"[^>]*>/)?.[0] ?? '';
    expect(tag).toContain('aria-labelledby="settings-title"');
    expect(tag).toContain('closedby="any"');
    expect(tag).not.toContain('role=');
    expect(tag).not.toContain('aria-modal');
  });

  it('인트로의 가장 큰 그림(첫 장면)은 먼저 받는다', () => {
    expect(html.match(/<img class="intro-backdrop"[^>]*>/)?.[0]).toContain('fetchpriority="high"');
  });
});
