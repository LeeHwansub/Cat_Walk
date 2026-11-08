import { isFurQuality } from '../cat/fur';
import { isTouchDevice, VirtualJoystick } from './joystick';
import { ACCESSORIES, BUILD_RANGE, clampBuild, clampSize, EAR_TYPES, EYE_COLORS, FUR_COLORS, PATTERNS, PRESETS, SIZE_RANGE, type CatAppearance, type GrowthStage } from '../cat/appearance';
import type { Game, HudState } from '../game';
import { hungerLabel } from '../systems/hunger';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** 화면(시작, 생성, HUD, 설정)과 게임을 연결한다. 상태 표시만 하고 게임 로직은 갖지 않는다. */
export function bindUi(game: Game): void {
  const start = $('screen-start');
  const create = $('screen-create');
  const hud = $('hud');
  // 모바일: 왼쪽 아래 조이스틱 (터치 기기에서만), 안내 문구도 터치 조작으로
  if (isTouchDevice()) {
    new VirtualJoystick(hud, (s) => game.setStick(s));
    // 오른쪽 아래 점프 버튼 (J-2)
    const jump = document.createElement('button');
    jump.className = 'jump-btn';
    jump.type = 'button';
    jump.textContent = '점프';
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.pressJump();
    });
    hud.appendChild(jump);
    const hint = hud.querySelector('.hint');
    if (hint) hint.textContent = '조이스틱 이동 (끝까지 밀면 달리기) · 점프 버튼 · 화면 드래그 회전 · 고양이 탭 쓰다듬기';
  }
  const settings = $('settings');
  game.setFadeElement($('fade'));

  let draft: CatAppearance = { ...game.save.cat };

  const show = (el: HTMLElement, v: boolean) => el.classList.toggle('hidden', !v);
  const firstGesture = () => game.audio.init();

  // ---------------- 시작 화면
  const btnContinue = $<HTMLButtonElement>('btn-continue');
  btnContinue.disabled = !game.hasSave;
  $('btn-new').onclick = () => {
    firstGesture();
    draft = { ...game.save.cat };
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
    chips('opt-accessory', ACCESSORIES.map((x) => ({ label: x.label, on: draft.accessory === x.id, pick: () => apply({ accessory: x.id }) })));
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
  $('btn-settings').onclick = () => openSettings();

  game.onHud = (s: HudState) => {
    $('hunger-fill').style.width = `${Math.round(s.hunger)}%`;
    $('hunger-label').textContent = hungerLabel(s.hunger);
    btnMode.textContent = s.mode === 'auto' ? '자동 생활' : s.manualLocked ? '직접 조작 (고정)' : '직접 조작';
    btnMode.classList.toggle('active', s.mode === 'manual');
    btnMode.title = s.mode === 'auto' ? '누르면 직접 조작 모드로 고정' : '누르면 자동 생활로 돌아감';
    btnCam.innerHTML = `${s.camera === 'follow' ? '고양이 시점' : '3인칭 시점'} <kbd>C</kbd>`;
  };

  // ---------------- 설정
  const muteAll = $<HTMLInputElement>('set-mute-all');
  const muteCat = $<HTMLInputElement>('set-mute-cat');
  const shake = $<HTMLInputElement>('set-shake');
  const fur = $<HTMLSelectElement>('set-fur');
  function openSettings() {
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
