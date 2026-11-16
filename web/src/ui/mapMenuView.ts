import { enableLightDismiss } from './dialog';
import { mapMenuItems, shouldSwitch, type MapEntry } from './mapMenu';
import { TIMES, TIME_LABEL, type TimeOfDay } from '../world/lighting';

interface MapMenuGame {
  readonly mapId: string;
  switchMap(id: string): void;
  readonly timeOfDay: TimeOfDay;
  setTimeOfDay(t: TimeOfDay): void;
}

/**
 * 지도 메뉴 화면 (D-58 3단계): 맵 목록(이름·한 줄 소개)을 띄우고, 다른 맵을 고르면 그 맵으로 옮긴 뒤 닫힌다.
 * 지금 있는 맵은 "여기"로 표시하고 누를 수 없다. 빈 곳을 누르거나 Esc·M으로 닫는다.
 * 브라우저 기본 <dialog>를 showModal()로 연다 (modern-web-guidance "dialog", 2026-11-16): 뒤 화면 잠금·포커스 가두기·Esc·포커스 되돌리기
 */
export function createMapMenu(parent: HTMLElement, game: MapMenuGame, maps: readonly MapEntry[]) {
  const root = document.createElement('dialog');
  root.className = 'map-menu panel map-panel';
  root.setAttribute('aria-labelledby', 'map-menu-title');
  const title = document.createElement('h2');
  title.id = 'map-menu-title';
  title.textContent = '지도';
  const list = document.createElement('div');
  list.className = 'map-list';
  // 시간대 (2026-11-16): 지금 맵의 낮·저녁·밤. 맵마다 저장된다. T 키로도 바꾼다
  const timeTitle = document.createElement('h3');
  timeTitle.className = 'time-title';
  timeTitle.id = 'map-menu-time';
  timeTitle.textContent = '시간 (T)';
  const timeRow = document.createElement('div');
  timeRow.className = 'time-pick';
  timeRow.setAttribute('role', 'group');
  timeRow.setAttribute('aria-labelledby', 'map-menu-time');
  const timeBtns = TIMES.map((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = TIME_LABEL[t];
    b.addEventListener('click', () => {
      game.setTimeOfDay(t);
      renderTime();
    });
    timeRow.appendChild(b);
    return { t, b };
  });
  const renderTime = () => {
    for (const { t, b } of timeBtns) b.setAttribute('aria-pressed', String(t === game.timeOfDay));
  };
  root.append(title, list, timeTitle, timeRow);
  parent.appendChild(root);
  enableLightDismiss(root); // 빈 곳(배경)을 누르면 닫는다

  function render() {
    list.replaceChildren(
      ...mapMenuItems(maps, game.mapId).map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'map-item';
        b.classList.toggle('current', m.current);
        b.disabled = m.current;
        const name = document.createElement('b');
        name.textContent = m.name;
        if (m.current) {
          const here = document.createElement('span');
          here.className = 'map-here';
          here.textContent = '여기';
          name.append(' ', here);
        }
        const blurb = document.createElement('span');
        blurb.className = 'map-blurb';
        blurb.textContent = m.blurb;
        b.append(name, blurb);
        b.addEventListener('click', () => {
          if (shouldSwitch(maps, game.mapId, m.id)) game.switchMap(m.id);
          close();
        });
        return b;
      }),
    );
  }

  function open() {
    render();
    renderTime();
    if (!root.open) root.showModal();
  }
  function close() {
    if (root.open) root.close();
  }
  const isOpen = () => root.open;
  return { open, close, isOpen, toggle: () => (isOpen() ? close() : open()), refreshTime: renderTime };
}
