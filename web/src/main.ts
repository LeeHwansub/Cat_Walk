import { Game } from './game';
import { bindUi } from './ui/ui';

const container = document.getElementById('app')!;

try {
  const game = new Game(container);
  bindUi(game);
  game.start();
  // 개발 서버에서만 브라우저 점검용으로 노출한다 (프로덕션 빌드에서는 제거됨)
  if (import.meta.env.DEV) (window as unknown as { __catWalk: Game }).__catWalk = game;
} catch (err) {
  console.error(err);
  const el = document.getElementById('error')!;
  el.textContent = '3D 화면을 시작할 수 없습니다. WebGL을 지원하는 최신 브라우저에서 다시 열어 주세요.';
  el.classList.remove('hidden');
}
