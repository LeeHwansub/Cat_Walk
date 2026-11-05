/** 키보드 입력. 이동은 WASD·방향키, 단발 키(C 시점 전환, F 먹이, Esc 설정) */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed: string[] = [];

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

  /** x: 오른쪽(+)/왼쪽(-), z: 앞(+)/뒤(-) */
  move(): { x: number; z: number } {
    const x = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    const z = (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0);
    return { x, z };
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
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}
