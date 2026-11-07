import { RUN_PUSH, type StickState } from '../ui/joystick';

/**
 * 키보드 + 모바일 조이스틱 입력. 이동은 WASD·방향키 또는 조이스틱,
 * 단발 키(C 시점 전환, F 먹이, Esc 설정)
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed: string[] = [];
  /** 모바일 조이스틱 (안 쓰면 0) */
  private stick: StickState = { x: 0, z: 0, mag: 0 };

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      const k = e.code;
      if (k.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(k)) this.pressed.push(k);
      this.down.add(k);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  /** x: 오른쪽(+)/왼쪽(-), z: 앞(+)/뒤(-). 키보드를 누르고 있으면 키보드, 아니면 조이스틱 */
  move(): { x: number; z: number } {
    const x = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    const z = (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
    if (x !== 0 || z !== 0) return { x, z };
    return { x: this.stick.x, z: this.stick.z };
  }

  /** 모바일 조이스틱 상태 */
  setStick(s: StickState): void {
    this.stick = s;
  }

  /** 달리기: Shift를 누르고 있거나 조이스틱을 끝까지 밀었을 때 */
  running(): boolean {
    return this.has('ShiftLeft', 'ShiftRight') || this.stick.mag >= RUN_PUSH;
  }

  /** 지난 호출 이후 눌린 단발 키 */
  takePressed(): string[] {
    return this.pressed.splice(0);
  }

  private has(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }
}

function isTyping(t: EventTarget | null): boolean {
  if (typeof HTMLInputElement === 'undefined') return false; // 테스트(노드) 환경
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
