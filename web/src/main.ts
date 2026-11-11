import type * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CAT_GROOM_URL, CAT_POSES_URL, loadCatModel, loadMotion, loadRunMotion } from './cat/catModel';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Game } from './game';
import type { CatAppearance } from './cat/appearance';
import { ProceduralCatRig } from './cat/ProceduralCatRig';
import { SkinnedCatRig } from './cat/SkinnedCatRig';
import { loadPropModels, type PropModels } from './world/propModels';
import { bindUi } from './ui/ui';

const container = document.getElementById('app')!;

async function boot(): Promise<void> {
  // 고양이 모델(glb)을 먼저 불러온다. 실패하면 이전 도형 모델로 시작한다.
  // 개발 중 비교용: 주소 뒤에 ?rig=procedural 을 붙이면 도형 모델을 쓴다.
  let catModel: THREE.Object3D | null = null;
  let runMotion: THREE.Object3D | null = null;
  let groomMotion: THREE.Object3D | null = null;
  let liePoses: THREE.Object3D | null = null;
  // 맵 소품 모델 (Polyfork, 시범): 고양이 모델과 함께 불러온다. 실패한 것은 상자로 대신한다
  const propsLoading = loadPropModels(new GLTFLoader(), import.meta.env.BASE_URL);
  if (new URLSearchParams(location.search).get('rig') !== 'procedural') {
    try {
      [catModel, runMotion, groomMotion, liePoses] = await Promise.all([loadCatModel(), loadRunMotion(), loadMotion(CAT_GROOM_URL), loadMotion(CAT_POSES_URL)]);
    } catch (err) {
      console.error('고양이 모델을 불러오지 못해 도형 모델로 시작합니다', err);
    }
  }
  const propModels: PropModels = await propsLoading;
  const motions = { run: runMotion, groom: groomMotion, poses: liePoses };
  // 다른 사람 고양이(멀티플레이, D-59)용 원본: 내 고양이가 모델 장면을 가져다 쓰기 전에 복제해 둔다. 동작 파일은 읽기만 해서 함께 쓴다
  const template = catModel ? cloneSkinned(catModel) : null;
  if (template && catModel) template.animations = catModel.animations;
  const makeRemoteRig = (look: CatAppearance) => {
    if (!template) return new ProceduralCatRig(look);
    const scene = cloneSkinned(template);
    scene.animations = template.animations; // 걷기 클립
    return new SkinnedCatRig(look, scene, motions);
  };
  const game = new Game(container, catModel, motions, propModels, makeRemoteRig);
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
