import { mapMenuItems, shouldSwitch, type MapEntry } from './mapMenu';

interface MapMenuGame {
  readonly mapId: string;
  switchMap(id: string): void;
}

/**
 * 지도 메뉴 화면 (D-58 3단계): 맵 목록(이름·한 줄 소개)을 띄우고, 다른 맵을 고르면 그 맵으로 옮긴 뒤 닫힌다.
 * 지금 있는 맵은 "여기"로 표시하고 누를 수 없다. 빈 곳을 누르거나 Esc·M으로 닫는다
 */
export function createMapMenu(parent: HTMLElement, game: MapMenuGame, maps: readonly MapEntry[]) {
  const root = document.createElement('div');
  root.className = 'map-menu hidden';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '지도');
  const panel = document.createElement('div');
  panel.className = 'panel map-panel';
  const title = document.createElement('h2');
  title.textContent = '지도';
  const list = document.createElement('div');
  list.className = 'map-list';
  panel.append(title, list);
  root.appendChild(panel);
  panel.addEventListener('click', (e) => e.stopPropagation());
  root.addEventListener('click', () => close()); // 빈 곳을 누르면 닫는다
  parent.appendChild(root);

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
    root.classList.remove('hidden');
  }
  function close() {
    root.classList.add('hidden');
  }
  const isOpen = () => !root.classList.contains('hidden');
  return { open, close, isOpen, toggle: () => (isOpen() ? close() : open()) };
}
