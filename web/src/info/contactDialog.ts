import { CONTACT_EMAIL, CONTACT_QUESTION, CONTACT_TOPICS, mailtoUrl } from './contact';
import { escapeHtml } from './render';
import { enableLightDismiss } from '../ui/dialog';

/**
 * 문의 창: 검은 고양이가 "무엇을 문의하러 오셨냐옹?"이라고 묻고, 유형을 고르면 메일 쓰기 창을 연다.
 * 3D(three.js)는 창을 열 때만 불러와 정보 페이지는 가볍게 둔다.
 * 브라우저 기본 <dialog>를 showModal()로 연다 (modern-web-guidance "dialog", 2026-11-16): 뒤 페이지 잠금·포커스 가두기·Esc·
 * 닫은 뒤 문의 버튼으로 포커스 되돌리기는 브라우저가 한다. 바깥(배경)을 눌러도 닫힌다
 */
export function openContactDialog(): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'contact-dialog';
  dialog.setAttribute('aria-labelledby', 'contact-q');
  dialog.innerHTML = `
      <div class="contact-cat">
        <canvas class="contact-canvas" aria-hidden="true"></canvas>
        <span class="contact-fallback" hidden>🐈‍⬛</span>
      </div>
      <p id="contact-q" class="contact-q">${escapeHtml(CONTACT_QUESTION)}</p>
      <div class="contact-topics">
        ${CONTACT_TOPICS.map((t) => `<a class="contact-topic" data-id="${t.id}" href="${escapeHtml(mailtoUrl(t))}">${escapeHtml(t.label)}</a>`).join('')}
      </div>
      <p class="contact-mail">메일 프로그램이 열리지 않으면 <b>${escapeHtml(CONTACT_EMAIL)}</b>로 보내 주세요.
        <button type="button" class="contact-copy">주소 복사</button></p>
      <p class="contact-done" role="status" aria-live="polite"></p>
      <button type="button" class="contact-close">닫기</button>`;
  document.body.appendChild(dialog);
  enableLightDismiss(dialog);

  const canvas = dialog.querySelector<HTMLCanvasElement>('.contact-canvas')!;
  const fallback = dialog.querySelector<HTMLElement>('.contact-fallback')!;
  const status = dialog.querySelector<HTMLElement>('.contact-done')!;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view: { hop(): void; dispose(): void; resize(): void } | null = null;
  let closed = false;

  const showFallback = () => {
    canvas.hidden = true;
    fallback.hidden = false;
  };
  import('./blackCatView')
    .then(async ({ BlackCatView }) => {
      if (closed) return;
      try {
        const v = new BlackCatView(canvas, reduceMotion);
        view = v;
        if (!(await v.start())) showFallback();
      } catch {
        showFallback(); // WebGL을 쓸 수 없는 환경
      }
    })
    .catch(showFallback);

  // 닫기 버튼·Esc·바깥 누르기 어느 쪽으로 닫혀도 여기서 정리한다
  dialog.addEventListener('close', () => {
    closed = true;
    view?.dispose();
    dialog.remove();
    window.removeEventListener('resize', onResize);
  });
  const onResize = () => view?.resize();
  window.addEventListener('resize', onResize);
  dialog.querySelector('.contact-close')!.addEventListener('click', () => dialog.close());
  for (const a of dialog.querySelectorAll<HTMLAnchorElement>('.contact-topic')) {
    a.addEventListener('click', () => {
      view?.hop();
      status.textContent = '메일 쓰기 창을 열었다냥. 내용을 적어 보내 주세요!';
    });
  }
  dialog.querySelector('.contact-copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      status.textContent = '주소를 복사했다냥.';
    } catch {
      status.textContent = `복사하지 못했어요. ${CONTACT_EMAIL} 을 직접 적어 주세요.`;
    }
  });
  dialog.querySelector<HTMLElement>('.contact-topic')?.setAttribute('autofocus', ''); // 처음 포커스는 첫 문의 유형
  dialog.showModal();
}
