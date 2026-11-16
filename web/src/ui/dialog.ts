/**
 * 브라우저 기본 <dialog> 도우미 (modern-web-guidance "dialog", 2026-11-16).
 * showModal()로 열면 브라우저가 뒤 페이지 잠금·포커스 가두기·Esc 닫기·닫은 뒤 포커스 되돌리기를 해 준다.
 * 바깥(배경)을 눌러 닫기는 closedby="any"로 하고, 이를 지원하지 않는 브라우저(Safari)에서만 누른 위치로 직접 판단한다.
 */

interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 점 (x, y)가 사각형 밖인가 (테두리는 안쪽) */
export function isOutside(r: RectLike, x: number, y: number): boolean {
  return x < r.left || x > r.right || y < r.top || y > r.bottom;
}

/**
 * 바깥을 누르면 닫히게 한다. 대체 처리는 눌린 대상(event.target)이 아니라 위치로 판단한다:
 * <dialog>는 자기 여백·자식 사이 빈틈을 눌러도 대상이 되므로, 대상으로 보면 창 안을 눌러도 닫힌다.
 * 누를 때와 뗄 때 모두 밖이어야 닫는다 (창 안에서 글자를 끌어 선택하다 밖에서 떼면 닫지 않는다)
 */
export function enableLightDismiss(dialog: HTMLDialogElement): void {
  dialog.setAttribute('closedby', 'any');
  if ('closedBy' in HTMLDialogElement.prototype) return;
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = isOutside(dialog.getBoundingClientRect(), e.clientX, e.clientY);
  });
  dialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && isOutside(dialog.getBoundingClientRect(), e.clientX, e.clientY)) dialog.close();
  });
}
