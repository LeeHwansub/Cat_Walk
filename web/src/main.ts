import type * as THREE from 'three';
import { CAT_GROOM_URL, loadCatModel, loadMotion, loadRunMotion } from './cat/catModel';
import { Game } from './game';
import { bindUi } from './ui/ui';

const container = document.getElementById('app')!;

async function boot(): Promise<void> {
  // 고양이 모델(glb)을 먼저 불러온다. 실패하면 이전 도형 모델로 시작한다.
  // 개발 중 비교용: 주소 뒤에 ?rig=procedural 을 붙이면 도형 모델을 쓴다.
  let catModel: THREE.Object3D | null = null;
  let runMotion: THREE.Object3D | null = null;
  let groomMotion: THREE.Object3D | null = null;
  if (new URLSearchParams(location.search).get('rig') !== 'procedural') {
    try {
      [catModel, runMotion, groomMotion] = await Promise.all([loadCatModel(), loadRunMotion(), loadMotion(CAT_GROOM_URL)]);
    } catch (err) {
      console.error('고양이 모델을 불러오지 못해 도형 모델로 시작합니다', err);
    }
  }
  const game = new Game(container, catModel, { run: runMotion, groom: groomMotion });
  bindUi(game);
  game.start();
  // 개발 서버에서만 브라우저 점검용으로 노출한다 (프로덕션 빌드에서는 제거됨)
  if (import.meta.env.DEV) (window as unknown as { __catWalk: Game }).__catWalk = game;
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('error')!;
  el.textContent = '3D 화면을 시작할 수 없습니다. WebGL을 지원하는 최신 브라우저에서 다시 열어 주세요.';
  el.classList.remove('hidden');
});
