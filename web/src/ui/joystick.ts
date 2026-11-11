/**
 * 모바일 가상 조이스틱 (사용자 요청 2026-11-07, 지시서 07 4단계 9번 일부).
 * 왼쪽 아래 원판을 손가락으로 밀면 그 방향으로 걷고, 끝까지 밀면 달린다.
 * 화면(캔버스)과 별도 요소라 카메라 드래그·쓰다듬기와 겹치지 않는다.
 */

/** 이 크기(0~1) 이상 밀면 달리기 */
export const RUN_PUSH = 0.92;
/** 가운데 데드존 (반지름 비율) */
const DEAD = 0.15;

/**
 * 손가락 위치(원판 가운데 기준 px, 화면 아래가 +y) → 이동 방향.
 * x: 오른쪽(+), z: 앞(+, 화면 위쪽), mag: 0~1
 */
export function stickVector(dx: number, dy: number, radius: number): { x: number; z: number; mag: number } {
  const d = Math.hypot(dx, dy);
  const raw = Math.min(1, d / radius);
  if (raw <= DEAD) return { x: 0, z: 0, mag: 0 };
  const mag = (raw - DEAD) / (1 - DEAD);
  return { x: (dx / d) * mag, z: (-dy / d) * mag, mag };
}

export interface StickState {
  x: number;
  z: number;
  mag: number;
}

/** 조이스틱 화면 요소. onChange로 방향을 넘긴다 */
export class VirtualJoystick {
  readonly el: HTMLElement;
  private readonly knob: HTMLElement;
  private pointerId: number | null = null;
  private center = { x: 0, y: 0 };

  constructor(
    parent: HTMLElement,
    private readonly onChange: (s: StickState) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.el.setAttribute('aria-hidden', 'true'); // 키보드 사용자는 방향키를 쓴다
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.el.appendChild(this.knob);
    parent.appendChild(this.el);

    this.el.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      e.preventDefault();
      this.pointerId = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      const r = this.el.getBoundingClientRect();
      this.center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.el.classList.add('active');
      this.update(e.clientX, e.clientY);
    });
    this.el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) this.update(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.el.classList.remove('active');
      this.knob.style.transform = '';
      this.onChange({ x: 0, z: 0, mag: 0 });
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }

  private get radius(): number {
    return this.el.clientWidth / 2 - this.knob.clientWidth / 4;
  }

  private update(px: number, py: number): void {
    const dx = px - this.center.x;
    const dy = py - this.center.y;
    const r = this.radius;
    const d = Math.hypot(dx, dy);
    const k = d > r ? r / d : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.onChange(stickVector(dx, dy, r));
  }

  setVisible(on: boolean): void {
    this.el.classList.toggle('hidden', !on);
  }
}

/**
 * 손가락으로 조작할 수 있는 기기인지 (휴대폰·태블릿·터치 화면).
 * 주 입력(pointer)만 보면 데스크톱 보기·키보드를 붙인 태블릿에서 아니라고 나와 조이스틱이 없었다 (사용자 보고 2026-11-11):
 * 아무 입력(any-pointer)이 손가락이거나 터치 지점이 있으면 터치 기기로 본다
 */
export function isTouchDevice(): boolean {
  const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const touchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0;
  return mq('(pointer: coarse)') || mq('(any-pointer: coarse)') || touchPoints > 0;
}
