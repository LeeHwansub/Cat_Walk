import { isFurQuality } from '../cat/fur';
import { isTouchDevice, VirtualJoystick } from './joystick';
import { BUILD_RANGE, clampBuild, clampSize, EAR_TYPES, EYE_COLORS, FUR_COLORS, PATTERNS, PRESETS, SIZE_RANGE, type CatAppearance, type GrowthStage } from '../cat/appearance';
import type { Game, HudState } from '../game';
import { hungerLabel } from '../systems/hunger';
import { createPoseMenu } from './poseMenuView';
import { createMapMenu } from './mapMenuView';
import { MAPS } from '../world/maps';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** 화면(시작, 생성, HUD, 설정)과 게임을 연결한다. 상태 표시만 하고 게임 로직은 갖지 않는다. */
export function bindUi(game: Game): void {
  const start = $('screen-start');
  const create = $('screen-create');
  const hud = $('hud');
  // 모바일: 왼쪽 아래 조이스틱 + 오른쪽 아래 점프 버튼 (J-2).
  // 터치 기기로 보이면 바로, 아니어도 손가락으로 화면을 처음 누르는 순간 만든다 (감지가 빗나가도 움직일 수 있게, 2026-11-11)
  let touchControls = false;
  // 작은 화면 배치 (터치 기기이거나 폭 640px 이하): 아래 버튼 한 줄·짧은 이름, 키 표시·안내 문구 숨김 (styles.css body.compact)
  const narrow = typeof matchMedia === 'function' ? matchMedia('(max-width: 640px)') : null;
  let lastHud: HudState | null = null;
  const updateCompact = () => {
    document.body.classList.toggle('compact', touchControls || !!narrow?.matches);
    if (lastHud) game.onHud(lastHud);
  };
  narrow?.addEventListener('change', updateCompact);
  const addTouchControls = () => {
    if (touchControls) return;
    touchControls = true;
    updateCompact();
    new VirtualJoystick(hud, (s) => game.setStick(s));
    const jump = document.createElement('button');
    jump.className = 'jump-btn';
    jump.type = 'button';
    jump.textContent = '점프';
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.pressJump();
    });
    hud.appendChild(jump);
  };
  updateCompact();
  if (isTouchDevice()) addTouchControls();
  else {
    const onFirstTouch = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      window.removeEventListener('pointerdown', onFirstTouch);
      addTouchControls();
    };
    window.addEventListener('pointerdown', onFirstTouch);
  }
  const settings = $('settings');
  game.setFadeElement($('fade'));

  let draft: CatAppearance = { ...game.save.cat };

  const show = (el: HTMLElement, v: boolean) => el.classList.toggle('hidden', !v);
  const firstGesture = () => game.audio.init();

  // ---------------- 시작 화면
  const btnContinue = $<HTMLButtonElement>('btn-continue');
  btnContinue.disabled = !game.hasSave;
  const nickInput = $<HTMLInputElement>('opt-nick');
  $('btn-new').onclick = () => {
    firstGesture();
    draft = { ...game.save.cat };
    nickInput.value = game.nick;
    renderCreate();
    show(start, false);
    show(create, true);
    game.setPhase('create');
  };
  btnContinue.onclick = () => {
    firstGesture();
    show(start, false);
    show(hud, true);
    game.setPhase('play');
  };
  $('btn-settings-start').onclick = () => {
    firstGesture();
    openSettings();
  };

  // ---------------- 고양이 생성
  $('btn-create-back').onclick = () => {
    game.setAppearance(game.save.cat);
    show(create, false);
    show(start, true);
    game.setPhase('menu');
  };
  $('btn-create-done').onclick = () => {
    game.setAppearance(draft);
    game.setNick(nickInput.value); // 비었거나 규칙에 맞지 않으면 그대로 (놀이를 시작할 때 자동 이름)
    game.persist();
    show(create, false);
    show(hud, true);
    game.setPhase('play');
  };

  function apply(next: Partial<CatAppearance>) {
    draft = { ...draft, ...next };
    game.setAppearance(draft);
    renderCreate();
  }

  function renderCreate() {
    chips('opt-presets', PRESETS.map((p) => ({ label: p.label, on: false, pick: () => apply(p.appearance) })));
    swatches('opt-fur', FUR_COLORS.map((c) => ({ hex: c.hex, label: c.label, on: draft.furColor === c.hex, pick: () => apply({ furColor: c.hex }) })));
    chips('opt-pattern', PATTERNS.map((p) => ({ label: p.label, on: draft.pattern === p.id, pick: () => apply({ pattern: p.id }) })));
    swatches('opt-eye', EYE_COLORS.map((c) => ({ hex: c.hex, label: c.label, on: draft.eyeColor === c.hex, pick: () => apply({ eyeColor: c.hex }) })));
    chips('opt-ear', EAR_TYPES.map((e) => ({ label: e.label, on: draft.ear === e.id, pick: () => apply({ ear: e.id }) })));
    // 단계를 바꾸면 크기 조절 값을 새 단계 범위 안으로 맞춘다 (D-24)
    const pickStage = (stage: GrowthStage) => apply({ stage, size: clampSize(stage, draft.size) });
    chips('opt-stage', [
      { label: '새끼', on: draft.stage === 'kitten', pick: () => pickStage('kitten') },
      { label: '성체', on: draft.stage === 'adult', pick: () => pickStage('adult') },
    ]);
    const [min, max] = SIZE_RANGE[draft.stage];
    sizeInput.min = String(Math.round(min * 100));
    sizeInput.max = String(Math.round(max * 100));
    sizeInput.value = String(Math.round(draft.size * 100));
    sizeLabel.textContent = `${Math.round(draft.size * 100)}%`;
    buildInput.value = String(Math.round(draft.build * 100));
    buildLabel.textContent = `${Math.round(draft.build * 100)}%`;
  }

  // 체형 조절 바: 날씬 ↔ 통통, 움직이는 즉시 미리보기에 반영 (사용자 요청 2026-11-05)
  const buildInput = $<HTMLInputElement>('opt-build');
  const buildLabel = $('opt-build-label');
  buildInput.min = String(Math.round(BUILD_RANGE[0] * 100));
  buildInput.max = String(Math.round(BUILD_RANGE[1] * 100));
  buildInput.oninput = () => {
    draft = { ...draft, build: clampBuild(Number(buildInput.value) / 100) };
    buildLabel.textContent = `${Math.round(draft.build * 100)}%`;
    game.setAppearance(draft);
  };

  // 크기 조절 바: 움직이는 즉시 미리보기에 반영 (지시서 2단계 성장 단계 + 크기 조절)
  const sizeInput = $<HTMLInputElement>('opt-size');
  const sizeLabel = $('opt-size-label');
  sizeInput.oninput = () => {
    draft = { ...draft, size: clampSize(draft.stage, Number(sizeInput.value) / 100) };
    sizeLabel.textContent = `${Math.round(draft.size * 100)}%`;
    game.setAppearance(draft);
  };

  // ---------------- HUD
  const btnMode = $<HTMLButtonElement>('btn-mode');
  const btnCam = $<HTMLButtonElement>('btn-camera');
  btnMode.onclick = () => game.toggleMode();
  btnCam.onclick = () => game.toggleCamera();
  $('btn-feed').onclick = () => game.giveFood();
  // 포즈 메뉴: 고양이 둘레에 자세 실루엣을 펼친다 (P 키도)
  const poseMenu = createPoseMenu(hud, game);
  // 지도 메뉴: 맵 목록에서 골라 옮긴다 (M 키도, D-58 3단계). 두 메뉴는 한 번에 하나만 연다
  const mapMenu = createMapMenu(hud, game, MAPS);
  const togglePose = () => {
    mapMenu.close();
    poseMenu.toggle();
  };
  const toggleMap = () => {
    poseMenu.close();
    mapMenu.toggle();
  };
  $('btn-pose').onclick = (e) => {
    e.stopPropagation();
    togglePose();
  };
  $('btn-map').onclick = (e) => {
    e.stopPropagation();
    toggleMap();
  };
  game.onPoseKey = togglePose;
  game.onMapKey = toggleMap;
  $('btn-settings').onclick = () => openSettings();

  // ---------------- 함께 놀기 (멀티플레이, D-59): 접속 상태·인원, 채팅
  const badge = $('net-badge');
  const chat = $('chat');
  const chatLog = $('chat-log');
  const chatForm = $<HTMLFormElement>('chat-form');
  const chatInput = $<HTMLInputElement>('chat-input');
  const btnChat = $<HTMLButtonElement>('btn-chat');
  let online = false;
  game.onNet = (status, count) => {
    online = status === 'online';
    badge.textContent = online ? `함께 ${count}명` : '연결 중…';
    show(badge, status !== 'off');
    show(chat, online);
    show(btnChat, online);
    if (!online) closeChat();
  };
  game.onChat = (nick, text, mine) => {
    const li = document.createElement('li');
    li.classList.toggle('mine', mine);
    const who = document.createElement('b');
    who.textContent = nick; // 글자로만 넣는다 (다른 사람이 보낸 HTML을 해석하지 않음)
    li.append(who, document.createTextNode(text));
    chatLog.appendChild(li);
    while (chatLog.children.length > 30) chatLog.firstElementChild?.remove();
  };
  function openChat() {
    if (!online) return;
    show(chatForm, true);
    chatInput.focus();
  }
  function closeChat() {
    chatInput.value = '';
    chatInput.blur();
    show(chatForm, false);
  }
  chatForm.onsubmit = (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) game.sendChat(text);
    closeChat();
  };
  btnChat.onclick = () => (chatForm.classList.contains('hidden') ? openChat() : closeChat());
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' || game.phase !== 'play' || document.activeElement instanceof HTMLInputElement) return;
    if (!settings.classList.contains('hidden')) return;
    e.preventDefault();
    openChat();
  });

  game.onHud = (s: HudState) => {
    lastHud = s;
    const compact = document.body.classList.contains('compact');
    $('hunger-fill').style.width = `${Math.round(s.hunger)}%`;
    $('hunger-label').textContent = hungerLabel(s.hunger);
    // 작은 화면에서는 아래 버튼이 한 줄에 들어가게 짧은 이름 (2026-11-11)
    if (compact) btnMode.textContent = s.mode === 'auto' ? '자동' : s.manualLocked ? '직접 고정' : '직접';
    else btnMode.textContent = s.mode === 'auto' ? '자동 생활' : s.manualLocked ? '직접 조작 (고정)' : '직접 조작';
    btnMode.classList.toggle('active', s.mode === 'manual');
    btnMode.title = s.mode === 'auto' ? '누르면 직접 조작 모드로 고정' : '누르면 자동 생활로 돌아감';
    btnCam.innerHTML = compact ? '시점' : `${s.camera === 'follow' ? '고양이 시점' : '3인칭 시점'} <kbd>C</kbd>`;
  };

  // ---------------- 설정
  const muteAll = $<HTMLInputElement>('set-mute-all');
  const muteCat = $<HTMLInputElement>('set-mute-cat');
  const shake = $<HTMLInputElement>('set-shake');
  const fur = $<HTMLSelectElement>('set-fur');
  const setOnline = $<HTMLInputElement>('set-online');
  const setNick = $<HTMLInputElement>('set-nick');
  setOnline.onchange = () => game.setOnline(setOnline.checked);
  setNick.onchange = () => {
    game.setNick(setNick.value);
    setNick.value = game.nick; // 규칙에 맞게 바뀐 이름을 보여 준다
  };
  function openSettings() {
    setOnline.checked = game.save.online;
    setNick.value = game.nick;
    const s = game.save.settings;
    muteAll.checked = s.muteAll;
    muteCat.checked = s.muteCat;
    shake.checked = s.reduceCamShake;
    fur.value = s.furQuality;
    show(settings, true);
  }
  const onChange = () =>
    game.setSettings({ muteAll: muteAll.checked, muteCat: muteCat.checked, reduceCamShake: shake.checked, furQuality: isFurQuality(fur.value) ? fur.value : 'auto' });
  muteAll.onchange = muteCat.onchange = shake.onchange = fur.onchange = onChange;
  $('btn-settings-close').onclick = () => show(settings, false);
  settings.onclick = (e) => {
    if (e.target === settings) show(settings, false);
  };
  $('btn-reset').onclick = () => {
    if (!window.confirm('저장된 고양이와 설정을 모두 지울까요?')) return;
    game.reset();
    window.location.reload();
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (document.activeElement === chatInput) return closeChat();
    if (poseMenu.isOpen()) return poseMenu.close();
    if (mapMenu.isOpen()) return mapMenu.close();
    if (settings.classList.contains('hidden')) {
      if (game.phase === 'play') openSettings();
    } else show(settings, false);
  });

  game.setSettings(game.save.settings);
}

function chips(id: string, items: { label: string; on: boolean; pick: () => void }[]) {
  const el = $(id);
  el.replaceChildren(
    ...items.map((it) => {
      const b = document.createElement('button');
      b.textContent = it.label;
      b.classList.toggle('on', it.on);
      b.onclick = it.pick;
      return b;
    }),
  );
}

function swatches(id: string, items: { hex: string; label: string; on: boolean; pick: () => void }[]) {
  const el = $(id);
  el.replaceChildren(
    ...items.map((it) => {
      const b = document.createElement('button');
      b.style.background = it.hex;
      b.title = it.label;
      b.setAttribute('aria-label', it.label);
      b.classList.toggle('on', it.on);
      b.onclick = it.pick;
      return b;
    }),
  );
}
