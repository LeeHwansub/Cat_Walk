import type { BehaviorId } from '../behavior/types';
import { POSE_MENU, ringLayout } from './poseMenu';

/** 원 반지름·칸 크기 (CSS 픽셀). 좁은 화면에서는 ringLayout이 반지름을 줄인다 */
const RADIUS = 150;
const ITEM = 78; // CSS .pose-item 크기 (좁은 화면에서는 CSS가 줄이고, 실제 크기를 읽어 쓴다)

interface PoseMenuGame {
  catScreenPos(): { x: number; y: number } | null;
  doPose(id: BehaviorId): void;
}

/**
 * 포즈 메뉴 화면: 고양이 둘레에 자세 실루엣을 원으로 펼친다. 하나를 누르면 그 자세를 취하고 닫힌다.
 * 열려 있는 동안 매 프레임 고양이의 화면 위치를 따라간다. 빈 곳을 누르거나 Esc·P로 닫는다
 */
export function createPoseMenu(parent: HTMLElement, game: PoseMenuGame) {
  const root = document.createElement('div');
  root.className = 'pose-menu hidden';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '자세 고르기');
  const halo = document.createElement('div');
  halo.className = 'pose-halo';
  root.appendChild(halo);
  const items = POSE_MENU.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pose-item';
    b.title = p.label;
    const img = document.createElement('img');
    img.src = `${import.meta.env.BASE_URL}assets/ui/poses/${p.id}.png`;
    img.alt = '';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = p.label;
    b.append(img, label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      game.doPose(p.id);
      close();
    });
    root.appendChild(b);
    return b;
  });
  root.addEventListener('click', () => close()); // 빈 곳을 누르면 닫는다
  parent.appendChild(root);

  let raf = 0;
  const place = () => {
    const c = game.catScreenPos() ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const item = items[0].offsetWidth || ITEM;
    const pts = ringLayout(items.length, c, RADIUS, { width: window.innerWidth, height: window.innerHeight }, item);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    halo.style.transform = `translate(${cx}px, ${cy}px)`;
    items.forEach((b, i) => {
      b.style.transform = `translate(${pts[i].x - item / 2}px, ${pts[i].y - item / 2}px)`;
    });
    raf = requestAnimationFrame(place);
  };

  function open() {
    root.classList.remove('hidden');
    cancelAnimationFrame(raf);
    place();
  }
  function close() {
    root.classList.add('hidden');
    cancelAnimationFrame(raf);
  }
  const isOpen = () => !root.classList.contains('hidden');
  return { open, close, isOpen, toggle: () => (isOpen() ? close() : open()) };
}
