import type { TimeOfDay } from '../world/lighting';
import type { Weather } from '../world/weather';
import { skyButton, skyOptions, type SkyOption } from './skyMenu';

interface SkyGame {
  readonly timeOfDay: TimeOfDay;
  setTimeOfDay(t: TimeOfDay): void;
  readonly weather: Weather;
  setWeather(w: Weather): void;
}

/**
 * 시간·날씨 선택 창 (사용자 요청 2026-11-16: 설정·지도 메뉴가 아니라 따로 아이콘으로).
 * 오른쪽 위 아이콘(button)을 누르면 아래로 작은 창이 열린다. 브라우저 기본 popover="auto"로 띄운다:
 * 바깥을 누르거나 Esc를 누르면 브라우저가 닫고, 다른 popover가 열리면 저절로 닫힌다. 고르면 바로 바뀌고 창은 열린 채로 둔다
 */
export function createSkyMenu(button: HTMLButtonElement, parent: HTMLElement, game: SkyGame) {
  const icon = document.createElement('span');
  icon.className = 'sky-icon';
  icon.setAttribute('aria-hidden', 'true');
  const badge = document.createElement('span');
  badge.className = 'sky-badge';
  badge.setAttribute('aria-hidden', 'true');
  button.replaceChildren(icon, badge);

  const root = document.createElement('div');
  root.id = 'sky-menu';
  root.className = 'sky-menu panel';
  root.popover = 'auto';
  button.popoverTargetElement = root; // 누르면 열고 닫기 (브라우저 기본)
  button.setAttribute('aria-haspopup', 'true');

  const group = (id: string, title: string) => {
    const h = document.createElement('h3');
    h.id = id;
    h.textContent = title;
    const row = document.createElement('div');
    row.className = 'sky-pick';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-labelledby', id);
    root.append(h, row);
    return row;
  };
  const timeRow = group('sky-time-title', '시간 (T)');
  const weatherRow = group('sky-weather-title', '날씨');
  parent.appendChild(root);

  const buttons = <T,>(row: HTMLElement, opts: SkyOption<T>[], pick: (id: T) => void) =>
    row.replaceChildren(
      ...opts.map((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(o.selected));
        const i = document.createElement('span');
        i.className = 'sky-opt-icon';
        i.setAttribute('aria-hidden', 'true');
        i.textContent = o.icon;
        b.append(i, o.label);
        b.addEventListener('click', () => pick(o.id));
        return b;
      }),
    );

  /** 아이콘과(열려 있으면) 선택 창을 지금 상태로. 게임이 시간·날씨를 바꾸면 부른다 (T 키 포함) */
  function refresh() {
    const s = skyButton(game.timeOfDay, game.weather);
    icon.textContent = s.icon;
    badge.textContent = s.badge;
    button.setAttribute('aria-label', s.label);
    button.title = s.label;
    const o = skyOptions(game.timeOfDay, game.weather);
    buttons(timeRow, o.times, (t) => game.setTimeOfDay(t));
    buttons(weatherRow, o.weathers, (w) => game.setWeather(w));
  }

  // 아이콘 바로 아래, 오른쪽 끝을 맞춰 연다 (화면 밖으로 나가지 않게)
  root.addEventListener('beforetoggle', (e) => {
    if ((e as ToggleEvent).newState !== 'open') return;
    refresh();
    const r = button.getBoundingClientRect();
    root.style.top = `${Math.round(r.bottom + 8)}px`;
    root.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
  });
  button.addEventListener('click', (e) => e.stopPropagation()); // 화면 클릭(고양이 부르기 등)으로 넘어가지 않게
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  refresh();
  const isOpen = () => root.matches(':popover-open');
  return { refresh, isOpen, close: () => isOpen() && root.hidePopover() };
}
