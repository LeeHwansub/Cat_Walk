import { CONTACT_EMAIL, CONTACT_QUESTION, CONTACT_TOPICS, mailtoUrl } from './contact';
import { escapeHtml } from './render';

/**
 * 문의 창: 검은 고양이가 "무엇을 문의하러 오셨냐옹?"이라고 묻고, 유형을 고르면 메일 쓰기 창을 연다.
 * 3D(three.js)는 창을 열 때만 불러와 정보 페이지는 가볍게 둔다.
 */
export function openContactDialog(opener: HTMLElement): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'contact-backdrop';
  backdrop.innerHTML = `
    <div class="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-q">
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
      <button type="button" class="contact-close">닫기</button>
    </div>`;
  document.body.appendChild(backdrop);

  const dialog = backdrop.querySelector<HTMLElement>('.contact-dialog')!;
  const canvas = backdrop.querySelector<HTMLCanvasElement>('.contact-canvas')!;
  const fallback = backdrop.querySelector<HTMLElement>('.contact-fallback')!;
  const status = backdrop.querySelector<HTMLElement>('.contact-done')!;
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

  const close = () => {
    if (closed) return;
    closed = true;
    view?.dispose();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    opener.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const onResize = () => view?.resize();
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector('.contact-close')!.addEventListener('click', close);
  for (const a of backdrop.querySelectorAll<HTMLAnchorElement>('.contact-topic')) {
    a.addEventListener('click', () => {
      view?.hop();
      status.textContent = '메일 쓰기 창을 열었다냥. 내용을 적어 보내 주세요!';
    });
  }
  backdrop.querySelector('.contact-copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      status.textContent = '주소를 복사했다냥.';
    } catch {
      status.textContent = `복사하지 못했어요. ${CONTACT_EMAIL} 을 직접 적어 주세요.`;
    }
  });
  dialog.querySelector<HTMLElement>('.contact-topic')?.focus();
}
