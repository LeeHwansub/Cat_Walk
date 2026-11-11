import * as THREE from 'three';
import { AudioManager } from './audio/AudioManager';
import { BehaviorBrain, type Senses } from './behavior/brain';
import type { BehaviorId, InterestKind } from './behavior/types';
import { CameraRig, type CameraMode } from './camera/CameraRig';
import { effectiveScale, girthScale, type CatAppearance } from './cat/appearance';
import { CatAnimator, type AnimBehavior } from './cat/CatAnimator';
import { CatController, RUN_SPEED, WALK_SPEED } from './cat/CatController';
import { resolveFurQuality } from './cat/fur';
import { gazeAngles, GazePicker, type GazePoint } from './cat/gaze';
import { postureBlocksMovement } from './cat/posture';
import { ProceduralCatRig } from './cat/ProceduralCatRig';
import { SkinnedCatRig } from './cat/SkinnedCatRig';
import type { CatRig } from './cat/rig';
import { Input } from './core/input';
import type { StickState } from './ui/joystick';
import { createRng, type Rng } from './core/rng';
import { browserStore, clearSave, defaultSave, loadSave, writeSave, type KeyValueStore, type SaveData, type Settings } from './save/storage';
import { BalloonFloat, isBalloon } from './systems/balloon';
import { EatingSequence } from './systems/eating';
import { FoodBowl } from './systems/food';
import { feed, tickHunger, type ActivityState } from './systems/hunger';
import { Resident } from './systems/npc';
import { findLanding } from './cat/jump';
import { PoseHold } from './behavior/poseHold';
import { isFree, pathClear, STEP_UP } from './world/collision';
import type { Interest, Neighborhood } from './world/map/neighborhood';
import { disposeMap, mapById } from './world/maps';
import type { PropModels } from './world/propModels';
import { Stage } from './world/scene';
import { NetClient, type NetStatus } from './net/client';
import { shouldSend } from './net/interp';
import { cleanNick, type CatState } from './net/protocol';
import { RemotePlayers } from './net/remotePlayers';

export type Phase = 'menu' | 'create' | 'play';
export type ControlMode = 'auto' | 'manual';

export interface HudState {
  hunger: number;
  mode: ControlMode;
  manualLocked: boolean;
  camera: CameraMode;
}

/** 직접 조작 입력이 이 시간(초) 동안 없으면 자동 생활로 돌아간다 (기획서 4.1) */
const MANUAL_RETURN = 5;
const SNIFF_KINDS: InterestKind[] = ['grass', 'flower', 'pot', 'car', 'pond'];
/** 관심 지점별로 바라보는 높이 (m). 햇볕 자리·연못처럼 바라볼 물체가 없는 곳은 제외 */
const GAZE_HEIGHT: Partial<Record<InterestKind, number>> = { grass: 0.08, flower: 0.25, pot: 0.3, car: 0.5, food: 0.05, bench: 0.45 };

export class Game {
  phase: Phase = 'menu';
  mode: ControlMode = 'auto';
  manualLocked = false;
  save: SaveData;
  onHud: (s: HudState) => void = () => {};
  /** P 키: 포즈 메뉴 열고 닫기 (UI가 정한다) */
  onPoseKey: () => void = () => {};
  /** 멀티플레이 (D-59): 채팅 받음, 접속 상태·방 인원 */
  onChat: (nick: string, text: string, mine: boolean) => void = () => {};
  onNet: (status: NetStatus, count: number) => void = () => {};

  private readonly stage: Stage;
  /** 지금 맵 (switchMap으로 바뀐다, D-58) */
  private map!: Neighborhood;
  private readonly rig: CatRig;
  private readonly ctrl: CatController;
  private readonly animator = new CatAnimator();
  private readonly brain: BehaviorBrain;
  /** 포즈 메뉴로 고른 자세: 움직일 때까지 유지한다 */
  private readonly poseHold = new PoseHold();
  private readonly cam: CameraRig;
  readonly audio = new AudioManager();
  private readonly input = new Input(window);
  private readonly store: KeyValueStore = browserStore();
  private readonly rng: Rng = createRng(Date.now() & 0xffff);
  private readonly stationBowl: FoodBowl;
  private readonly userBowl: FoodBowl;
  private npc!: Resident;
  private readonly timer = new THREE.Timer();

  private time = 0;
  private lastInputAt = -100;
  private walkTarget: { x: number; z: number } | null = null;
  private sniffTarget: { x: number; z: number } | null = null;
  /** 진행 중인 먹기 흐름 (다가가기 → 냄새 → 먹기 → 입 핥기) */
  private eating: { seq: EatingSequence; bowl: FoodBowl } | null = null;
  /** 이번 프레임에 이동하려고 일어서는 중 */
  private standingUp = false;
  private moveHeldBefore = false;
  private lastEarTwitch = -10;
  /** 이스터 에그: 체형 최대일 때 풍선처럼 떠다니기 */
  private readonly balloon = new BalloonFloat();
  /** 시선: 바라볼 수 있는 대상(관심 지점, 주민 얼굴)과 고르는 규칙 */
  private gazePoints: GazePoint[] = [];
  private readonly gazePicker: GazePicker;
  private floatHeight = 0;
  private wasBalloon = false;
  private progressCheck = { at: 0, x: 0, z: 0 };
  /** 최근에 막힌 시각과 그때 바라보던 방향 (자동 모드에서 같은 쪽으로 다시 가지 않게) */
  private blocked: { at: number; heading: number } | null = null;
  private petUntil = 0;
  private userBowlHideAt = -1;
  private saveTimer = 0;
  private hudTimer = 0;
  private fadeEl: HTMLElement | null = null;
  /** 멀티플레이: 방 접속, 다른 사람 고양이, 마지막으로 보낸 내 상태 */
  private readonly net = new NetClient(location.origin);
  private readonly remotes: RemotePlayers;
  private netStatus: NetStatus = 'off';
  private joinedKey = '';
  private lastSent: CatState | null = null;
  private lastSentAt = -1;
  private resetting = false;

  /** catModel: 불러온 glb 고양이(없으면 이전 도형 모델) */
  constructor(
    private readonly container: HTMLElement,
    catModel: THREE.Object3D | null = null,
    motions: { run?: THREE.Object3D | null; groom?: THREE.Object3D | null; poses?: THREE.Object3D | null } = {},
    private readonly propModels: PropModels = {},
    /** 다른 사람 고양이 모델을 만든다 (glb를 복제, 없으면 도형 모델) */
    makeRemoteRig: (look: CatAppearance) => CatRig = (look) => new ProceduralCatRig(look),
  ) {
    this.save = loadSave(this.store) ?? defaultSave();
    this.stage = new Stage(container);

    this.rig = catModel ? new SkinnedCatRig(this.save.cat, catModel, motions) : new ProceduralCatRig(this.save.cat);
    this.stage.scene.add(this.rig.root);
    this.ctrl = new CatController({ bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, rects: [], circles: [] }, this.rig.cycleLength, effectiveScale(this.save.cat.stage, this.save.cat.size));
    this.ctrl.girth = girthScale(this.save.cat.build);

    this.audio.setVoice(this.save.cat.stage === 'kitten', this.save.cat.size);
    this.brain = new BehaviorBrain(this.rng);
    this.brain.interrupt('lookAround', 4, 0);

    this.stationBowl = new FoodBowl(0, 0);
    this.stationBowl.setFilled(true);
    this.userBowl = new FoodBowl(0, 0, '#f2c4c4');
    this.userBowl.group.visible = false;
    this.stage.scene.add(this.stationBowl.group, this.userBowl.group);
    this.gazePicker = new GazePicker(this.rng);
    // 저장된 맵과 그 맵 안의 위치 (예전 저장은 골목·공원 동네). 없는 맵이면 기본 맵의 출발점
    const def = mapById(this.save.mapId);
    this.loadMap(def.id, def.id === this.save.mapId ? this.save.position : null);

    this.remotes = new RemotePlayers(this.stage.scene, makeRemoteRig);
    this.remotes.onChat = (nick, text, mine) => this.onChat(nick, text, mine);
    this.remotes.onCount = (n) => this.onNet(this.netStatus, n);
    this.net.onMessage = (m) => this.remotes.handle(m, this.time);
    this.net.onStatus = (st) => {
      this.netStatus = st;
      if (st !== 'online') this.remotes.clear();
      this.onNet(st, this.remotes.count);
    };

    this.cam = new CameraRig(container.clientWidth / container.clientHeight);
    this.cam.attach(this.stage.renderer.domElement, () => this.time);
    this.cam.yaw = this.ctrl.heading;
    this.setPhase('menu');
    this.attachPetting();

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.persist();
    });
    window.addEventListener('pagehide', () => this.persist());
  }

  /** 지금 맵 id (지도 메뉴 표시용) */
  get mapId(): string {
    return this.save.mapId;
  }

  /**
   * 다른 맵으로 옮긴다 (D-58): 화면을 잠깐 어둡게 하고, 이전 맵을 내리고, 새 맵의 출발점에서 시작한다.
   * 먹기·걷기 목표·고른 자세는 끝낸다. 같은 맵이면 아무것도 하지 않는다
   */
  switchMap(id: string): void {
    const def = mapById(id);
    if (def.id === this.save.mapId) return;
    const swap = () => {
      this.clearTargets();
      this.poseHold.stop();
      this.blocked = null;
      this.petUntil = 0;
      this.userBowl.group.visible = false;
      this.userBowlHideAt = -1;
      disposeMap(this.map, this.propModels);
      this.npc.group.removeFromParent();
      this.loadMap(def.id, null);
      this.connectNet(); // 새 맵의 방으로
      this.cam.setMode(this.cam.mode, this.ctrl.heading); // 카메라를 새 자리로 바로 옮긴다
      this.brain.interrupt('lookAround', 3, this.time);
      this.persist();
      this.emitHud();
    };
    if (!this.fadeEl) return swap();
    this.fadeEl.classList.add('on');
    window.setTimeout(() => {
      swap();
      this.fadeEl?.classList.remove('on');
    }, 220);
  }

  /** 맵을 짓고 고양이·먹이 쉼터·주민·시선 대상을 그 맵에 맞춘다. at: 그 맵 안의 저장된 위치 (막혀 있으면 출발점) */
  private loadMap(id: string, at: { x: number; z: number } | null): void {
    const def = mapById(id);
    this.map = def.build(this.propModels);
    this.save.mapId = def.id;
    this.stage.scene.add(this.map.group);
    const start = at && isFree(this.map.collision, at.x, at.z, 0.2) ? at : this.map.spawn;
    this.ctrl.placeIn(this.map.collision, start.x, start.z, this.map.spawn.heading);
    const fs = this.map.foodStation;
    this.stationBowl.moveTo(fs.x, fs.z + 0.02);
    this.npc = new Resident(this.map.npcSpot.x, this.map.npcSpot.z, -2.4);
    this.stage.scene.add(this.npc.group);
    this.map.collision.circles.push({ x: this.npc.x, z: this.npc.z, r: 0.28 });
    this.gazePoints = [
      ...this.map.interests.filter((i) => GAZE_HEIGHT[i.kind] !== undefined).map((i) => ({ x: i.x, y: GAZE_HEIGHT[i.kind]!, z: i.z })),
      { x: this.npc.x, y: 1.55, z: this.npc.z }, // 주민 얼굴
    ];
  }

  // ---------------------------------------------------------------- 멀티플레이 (D-59)

  get nick(): string {
    return this.save.nick;
  }

  /** 닉네임을 바꾼다 (규칙에 맞지 않으면 그대로). 접속 중이면 다시 들어가 새 이름을 알린다 */
  setNick(nick: string): void {
    const n = cleanNick(nick);
    if (!n) return;
    this.save.nick = n;
    this.persist();
    this.connectNet();
  }

  /** 함께 놀기 켜기·끄기 */
  setOnline(on: boolean): void {
    this.save.online = on;
    this.persist();
    this.connectNet();
  }

  sendChat(text: string): void {
    this.net.sendChat(text);
  }

  /** 놀이 중이고 함께 놀기가 켜져 있으면 지금 맵의 방에 (닉네임·외형·맵이 바뀌었으면 다시) 들어간다 */
  private connectNet(): void {
    if (this.phase !== 'play' || !this.save.online) {
      this.joinedKey = '';
      this.net.leave();
      return;
    }
    if (!this.save.nick) {
      this.save.nick = `냥이${100 + Math.floor(Math.random() * 900)}`;
      this.persist();
    }
    const key = JSON.stringify([this.save.mapId, this.save.nick, this.save.cat]);
    if (key === this.joinedKey) return;
    this.joinedKey = key;
    this.lastSent = null;
    this.net.join(this.save.mapId, { nick: this.save.nick, look: this.save.cat });
  }

  /** 내 고양이 상태를 (바뀌었을 때만) 보내고, 다른 고양이를 그린다 */
  private netTick(now: number, dt: number, behavior: AnimBehavior): void {
    if (this.net.online) {
      const s: CatState = {
        x: round(this.ctrl.x),
        z: round(this.ctrl.z),
        y: round(this.ctrl.bodyY + this.floatHeight),
        h: round(Math.atan2(Math.sin(this.ctrl.heading), Math.cos(this.ctrl.heading))), // 여러 바퀴 돈 값도 −π~π로
        p: round(this.ctrl.bodyPitch),
        b: behavior,
        v: round(Math.min(10, this.ctrl.speed)),
        g: round(Math.min(1, Math.max(0, this.brain.progress(now)))),
      };
      if (shouldSend(this.lastSent, s, now - this.lastSentAt)) {
        this.net.sendState(s);
        this.lastSent = s;
        this.lastSentAt = now;
      }
    }
    const el = this.stage.renderer.domElement;
    this.remotes.update(now, dt, this.cam.active, { w: el.clientWidth, h: el.clientHeight });
  }

  get hasSave(): boolean {
    return loadSave(this.store) !== null;
  }

  start(): void {
    this.stage.renderer.setAnimationLoop(() => this.frame());
  }

  setFadeElement(el: HTMLElement): void {
    this.fadeEl = el;
  }

  // ---------------------------------------------------------------- 화면·상태 전환

  setPhase(phase: Phase): void {
    this.phase = phase;
    if (phase === 'menu') {
      this.cam.orbit = 0.1;
      this.cam.distance = 2.4;
      this.cam.pitch = 0.18;
    } else if (phase === 'create') {
      this.cam.orbit = 0.35;
      this.cam.distance = 1.05;
      this.cam.pitch = 0.2;
      this.brain.interrupt('sit', 1e9, this.time);
      this.walkTarget = null;
      if (this.cam.mode !== 'follow') this.cam.setMode('follow', this.ctrl.heading);
    } else {
      this.cam.orbit = 0;
      this.cam.distance = 1.7;
      this.cam.pitch = 0.16;
      this.cam.yaw = this.ctrl.heading;
      this.brain.interrupt('lookAround', 3, this.time);
    }
    this.connectNet(); // 놀이를 시작하면 함께 놀기 (켜져 있으면)
    this.emitHud();
  }

  setAppearance(a: CatAppearance): void {
    this.save.cat = { ...a };
    this.rig.setAppearance(a);
    // 크기에 맞춰 이동 속도·걸음 간격·충돌 반경(컨트롤러), 카메라 거리·높이(카메라), 울음 음높이를 함께 조정한다
    this.ctrl.scale = effectiveScale(a.stage, a.size);
    this.ctrl.cycleLength = this.rig.cycleLength;
    this.ctrl.girth = girthScale(a.build);
    this.audio.setVoice(a.stage === 'kitten', a.size);
  }

  setSettings(s: Settings): void {
    this.save.settings = { ...s };
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.rig.setFurQuality(resolveFurQuality(s.furQuality, coarse));
    this.audio.setMute(s.muteAll, s.muteCat);
    this.persist();
  }

  /** 모바일 조이스틱 방향 (ui/joystick.ts) */
  setStick(s: StickState): void {
    this.input.setStick(s);
  }

  /** 모바일 점프 버튼 (Space와 같다) */
  pressJump(): void {
    this.input.press('Space');
  }

  toggleCamera(): void {
    const next: CameraMode = this.cam.mode === 'follow' ? 'cat' : 'follow';
    // 시점 전환이 뚝 끊기지 않도록 화면을 잠깐 어둡게 했다가 바꾼다
    if (this.fadeEl) {
      this.fadeEl.classList.add('on');
      window.setTimeout(() => {
        this.cam.setMode(next, this.ctrl.heading);
        this.fadeEl?.classList.remove('on');
        this.emitHud();
      }, 180);
    } else {
      this.cam.setMode(next, this.ctrl.heading);
      this.emitHud();
    }
  }

  toggleMode(): void {
    if (this.mode === 'auto') {
      this.mode = 'manual';
      this.manualLocked = true;
      this.lastInputAt = this.time;
    } else {
      this.returnToAuto();
    }
    this.emitHud();
  }

  /**
   * 포즈 메뉴: 고른 자세를 취하고 움직일 때까지 유지한다 (직접 조작으로 바뀜, 사용자 결정 2026-11-09).
   * 먹는 중·떠 있을 때·점프 중에는 하지 않는다
   */
  doPose(id: BehaviorId): void {
    if (this.phase !== 'play' || this.eating?.seq.locksMovement || this.balloon.amount > 0.05 || this.ctrl.jumping) return;
    if (this.eating) this.cancelEating();
    this.petUntil = 0;
    if (this.mode === 'auto') {
      this.mode = 'manual';
      this.manualLocked = false;
      this.clearTargets();
    }
    const c = this.poseHold.start(id);
    this.brain.interrupt(c.id, c.duration, this.time);
    this.lastInputAt = this.time;
    this.emitHud();
  }

  /** 고양이 몸 가운데의 화면 위치 (CSS 픽셀). 카메라 뒤에 있으면 null */
  catScreenPos(): { x: number; y: number } | null {
    const v = new THREE.Vector3(this.ctrl.x, this.ctrl.bodyY + this.floatHeight + 0.14 * this.ctrl.scale, this.ctrl.z).project(this.cam.active);
    if (v.z > 1) return null;
    const el = this.stage.renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight };
  }

  /** 먹이 주기: 고양이 앞에 그릇을 놓는다 (기획서 8.2) */
  giveFood(): void {
    if (this.phase !== 'play') return;
    const s = this.ctrl.scale;
    let bx = this.ctrl.x + Math.sin(this.ctrl.heading) * 0.45 * s;
    let bz = this.ctrl.z + Math.cos(this.ctrl.heading) * 0.45 * s;
    if (!isFree(this.map.collision, bx, bz, 0.12)) {
      bx = this.ctrl.x - Math.sin(this.ctrl.heading) * 0.45 * s;
      bz = this.ctrl.z - Math.cos(this.ctrl.heading) * 0.45 * s;
    }
    this.userBowl.moveTo(bx, bz);
    this.userBowl.setFilled(true);
    this.userBowl.group.visible = true;
    this.userBowlHideAt = -1;
    this.audio.meow(this.save.hunger < 50 ? 'hungry' : 'normal');
    if (this.save.hunger < 85) this.startEating(this.userBowl);
  }

  /** 저장 초기화. 새로고침 직전 pagehide 이벤트가 다시 저장하지 않도록 자동 저장을 막는다. */
  reset(): void {
    this.resetting = true;
    clearSave(this.store);
  }

  persist(): void {
    if (this.resetting) return;
    if (this.phase === 'menu' && !this.hasSave) return;
    this.save.position = { x: this.ctrl.x, z: this.ctrl.z };
    writeSave(this.store, this.save);
  }

  // ---------------------------------------------------------------- 프레임

  private frame(): void {
    this.timer.update();
    const dt = Math.min(0.1, this.timer.getDelta());
    this.time += dt;
    const now = this.time;

    this.standingUp = false;
    this.handleKeys();
    if (this.phase === 'play') this.updatePlay(dt, now);
    else if (this.phase === 'menu') this.updateAuto(dt, now);
    else this.ctrl.brake(dt);

    // 이스터 에그: 체형 최대 → 풍선처럼 떠오른다 (생성 화면 미리보기에서도)
    const balloonOn = isBalloon(this.save.cat.build);
    if (balloonOn && !this.wasBalloon && this.phase !== 'menu') this.audio.meow('curious');
    this.wasBalloon = balloonOn;
    this.floatHeight = this.balloon.update(dt, now, balloonOn, this.ctrl.scale);
    this.ctrl.speedMul = 1 - 0.35 * this.balloon.amount; // 떠 있으면 조금 느리게 둥실둥실

    // 애니메이션
    const b = this.brain.current;
    let animBehavior: AnimBehavior = b.id;
    if (this.eating) animBehavior = this.eating.seq.animBehavior;
    else if (this.mode === 'manual' && this.phase === 'play') {
      // 포즈 메뉴로 고른 자세는 그 행동으로, 아니면 가만히 서 있기. 한 번 하는 동작이 끝나면 앉기로
      const after = this.poseHold.next(this.brain.progress(now));
      if (after) this.brain.interrupt(after.id, after.duration, now);
      animBehavior = this.poseHold.id ? this.brain.current.id : 'idle';
    }
    else if (b.id === 'eat') animBehavior = 'idle';
    const view = { x: this.ctrl.x, z: this.ctrl.z, heading: this.ctrl.heading, eyeY: this.ctrl.y + this.floatHeight + 0.25 * this.ctrl.scale };
    const lookAt = this.gazePicker.update(now, view, this.gazePoints);
    const pose = this.animator.update(
      {
        gaze: lookAt ? gazeAngles(view, lookAt) : null,
        behavior: animBehavior,
        progress: this.brain.progress(now),
        elapsed: now - b.startedAt,
        speed: this.ctrl.speed / this.ctrl.speedScale,
        turnRate: this.ctrl.turnRate,
        gaitPhase: this.ctrl.gaitPhase,
        petted: now < this.petUntil,
        standingUp: this.standingUp,
        floating: this.balloon.amount,
        jump: this.ctrl.jumpPose(),
      },
      dt,
    );
    if (this.rig.cycleLengthAt) this.ctrl.cycleLength = this.rig.cycleLengthAt(pose.run);
    // 높이 = 땅·계단·담 위 높이(J-1) + 풍선으로 뜬 높이
    // 보이는 몸은 bodyY·bodyPitch: 계단에서 경사로처럼 부드럽게 오르고 머리를 든다 (판정 높이 ctrl.y는 한 칸씩, 2026-11-10)
    this.rig.root.position.set(this.ctrl.x, this.ctrl.bodyY + this.floatHeight, this.ctrl.z);
    this.rig.root.rotation.set(-this.ctrl.bodyPitch, this.ctrl.heading, 0, 'YXZ');
    this.rig.setFirstPerson?.(this.cam.mode === 'cat');
    this.rig.setBodyFade?.(this.cam.bodyFade);
    this.rig.apply(pose, now);
    this.netTick(now, dt, animBehavior);

    this.cam.update(dt, now, { x: this.ctrl.x, y: this.ctrl.bodyY + this.floatHeight, z: this.ctrl.z, heading: this.ctrl.heading, speed: this.ctrl.speed, scale: this.ctrl.scale }, this.rig.eyeAnchor, this.map.occluders, this.save.settings.reduceCamShake);
    this.stage.followSun(this.ctrl.x, this.ctrl.z);
    this.audio.update(dt);
    this.stage.renderer.render(this.stage.scene, this.cam.active);
  }

  private handleKeys(): void {
    for (const k of this.input.takePressed()) {
      if (this.phase !== 'play') continue;
      if (k === 'KeyC') this.toggleCamera();
      if (k === 'KeyF') this.giveFood();
      if (k === 'Space') this.tryJump();
      if (k === 'KeyP') this.onPoseKey();
    }
  }

  /**
   * 점프 (J-2): 앞에 올라설 곳(담·평상·차 보닛 …)이 있으면 그 위로, 높은 곳이면 앞쪽 낮은 땅으로, 없으면 제자리에서 뛴다.
   * 직접 조작으로 바뀐다. 먹는 중·떠 있을 때는 뛰지 않고, 앉거나 누워 있으면 먼저 일어선다
   */
  private tryJump(): void {
    if (this.eating?.seq.locksMovement || this.balloon.amount > 0.05 || this.ctrl.jumping) return;
    if (this.eating) this.cancelEating();
    this.petUntil = 0;
    this.poseHold.stop();
    this.lastInputAt = this.time;
    if (this.mode === 'auto') {
      this.mode = 'manual';
      this.manualLocked = false;
      this.clearTargets();
      this.emitHud();
    }
    if (!this.readyToMove(0)) return;
    this.ctrl.jump();
  }

  /**
   * 자동 생활에서 높은 곳(담·차 위 …)에 있으면 먼저 뛰어내린다. 가장자리에서 멈추는 높은 곳에서는 걷기 목표에 갈 수 없다.
   * (높은 곳에 올라가 쉬는 행동은 J-5.) 뛰어내릴 곳이 있으면 true
   */
  private jumpDownIfHigh(): boolean {
    if (this.ctrl.y <= STEP_UP) return false;
    const r = 0.16 * this.ctrl.scale;
    for (let i = 0; i < 8; i++) {
      const h = this.ctrl.heading + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 4);
      const l = findLanding(this.map.collision, this.ctrl.x, this.ctrl.z, this.ctrl.y, h, this.ctrl.scale, r);
      if (l && l.y < this.ctrl.y - STEP_UP) {
        this.ctrl.heading = h;
        return this.ctrl.jump();
      }
    }
    return false;
  }

  private updatePlay(dt: number, now: number): void {
    const mv = this.input.move();
    const hasInput = mv.x !== 0 || mv.z !== 0;
    const pressedNow = hasInput && !this.moveHeldBefore;
    this.moveHeldBefore = hasInput;

    if (this.eating?.seq.locksMovement) {
      // 먹는 동안: 이동 입력은 무시하고 귀만 움찔한다 (카메라 회전·줌은 그대로)
      if (pressedNow && now - this.lastEarTwitch > 0.6) {
        this.rig.twitchEar();
        this.lastEarTwitch = now;
      }
    } else if (hasInput) {
      if (this.eating) this.cancelEating(); // 그릇으로 가던 중이면 사용자의 조작이 우선
      this.petUntil = 0;
      this.poseHold.stop(); // 움직이면 고른 자세는 끝 (앉거나 누워 있으면 먼저 일어선다)
      if (this.mode === 'auto') {
        this.mode = 'manual';
        this.manualLocked = false;
        this.clearTargets();
        this.emitHud();
      }
      this.lastInputAt = now;
    }

    if (this.eating) {
      this.updateEating(dt, now);
    } else if (this.mode === 'manual') {
      if (!this.poseHold.id) this.startEatingIfAtBowl(); // 자세를 취하는 동안에는 그릇 앞이어도 먹지 않는다
      this.ctrl.running = this.input.running() && this.balloon.amount < 0.05;
      if (hasInput && !this.readyToMove(dt)) {
        // 앉아 있거나 엎드려 있으면 일어선 뒤에 걷는다
      } else if (this.cam.mode === 'cat') {
        this.ctrl.moveTank(mv.x, mv.z, dt);
      } else {
        // 카메라 기준 방향을 월드 방향으로 바꾼다
        const fx = Math.sin(this.cam.yaw);
        const fz = Math.cos(this.cam.yaw);
        const rx = -Math.cos(this.cam.yaw);
        const rz = Math.sin(this.cam.yaw);
        this.ctrl.moveDirect(fx * mv.z + rx * mv.x, fz * mv.z + rz * mv.x, dt);
      }
      if (!this.manualLocked && !this.poseHold.id && now - this.lastInputAt > MANUAL_RETURN) this.returnToAuto();
    } else {
      this.updateAuto(dt, now);
    }

    // 배고픔 (압박 없이 천천히 감소)
    const id = this.brain.current.id;
    const state: ActivityState = this.mode === 'auto' && id === 'nap' ? 'nap' : this.ctrl.speed > 0.05 ? 'active' : 'rest';
    this.save.hunger = tickHunger(this.save.hunger, dt, state);

    // 주민: 고양이가 다가오면 빈 그릇을 채워 준다
    if (this.npc.update(now, dt, this.ctrl, !this.stationBowl.filled)) {
      this.stationBowl.setFilled(true);
      this.audio.meow('hungry'); // 먹이를 채워 주는 주민에게 조르는 울음
    }
    if (this.userBowlHideAt > 0 && now > this.userBowlHideAt) {
      this.userBowl.group.visible = false;
      this.userBowlHideAt = -1;
    }

    this.saveTimer += dt;
    if (this.saveTimer > 5) {
      this.saveTimer = 0;
      this.persist();
    }
    this.hudTimer += dt;
    if (this.hudTimer > 0.5) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  // ---------------------------------------------------------------- 자율 행동 실행

  private updateAuto(dt: number, now: number): void {
    // 점프 중에는 점프만 진행하고, 높은 곳에 있으면 먼저 뛰어내린다
    if (this.ctrl.jumping) return this.ctrl.brake(dt);
    if (this.jumpDownIfHigh()) return;
    const senses = this.senses();
    const before = this.brain.current;
    if (this.brain.update(dt, now, senses)) this.onBehaviorEnd(before.id);
    const cur = this.brain.current;
    if (cur !== before && cur.startedAt === now) this.onBehaviorStart(cur.id, now);

    switch (cur.id) {
      case 'walk': {
        if (!this.readyToMove(dt)) break;
        if (!this.walkTarget) this.walkTarget = this.pickWalkTarget();
        if (this.brain.current.id !== 'walk') break; // 배고파서 먹기로 바뀐 경우
        const arrived = this.ctrl.walkTo(this.walkTarget.x, this.walkTarget.z, dt);
        if (arrived) this.finishBehavior(now);
        else if (this.isStuck(now)) this.reactToBlock(now);
        break;
      }
      case 'eat':
        // 먹기 흐름은 updateEating이 처리한다. 흐름이 없으면(메뉴 화면 등) 제자리에 있는다.
        this.ctrl.brake(dt);
        break;
      case 'sniff':
        if (!this.readyToMove(dt)) break;
        if (this.sniffTarget) this.ctrl.face(this.sniffTarget.x, this.sniffTarget.z, dt);
        else this.ctrl.brake(dt);
        break;
      default:
        this.ctrl.brake(dt);
    }
  }

  private onBehaviorStart(id: BehaviorId, now: number): void {
    this.progressCheck = { at: now, x: this.ctrl.x, z: this.ctrl.z };
    if (id === 'walk') this.walkTarget = null;
    if (this.phase === 'menu') return;
    if (id === 'walk' && this.rng() < 0.1) this.audio.meow('normal');
    if (id === 'lookAround' && this.rng() < 0.15) this.audio.meow('curious');
    if (id === 'nap') this.audio.purr(6);
    if (id === 'sniff') this.sniffTarget = this.nearestInterest(SNIFF_KINDS);
    if (id === 'eat') {
      const bowl = this.nearestFilledBowl(1.6);
      if (bowl) this.startEating(bowl);
      else this.finishBehavior(now);
    }
  }

  private onBehaviorEnd(id: BehaviorId): void {
    if (id === 'walk') this.walkTarget = null;
    if (id === 'sniff') this.sniffTarget = null;
  }

  private finishBehavior(now: number): void {
    const before = this.brain.current.id;
    this.brain.finishCurrent(now, this.senses());
    this.onBehaviorEnd(before);
    this.onBehaviorStart(this.brain.current.id, now);
  }

  /** 이동하려는데 앉거나 엎드려 있으면 멈춘 채 일어서기를 요청한다. 걸어도 되면 true */
  private readyToMove(dt: number): boolean {
    if (!postureBlocksMovement(this.animator.pose)) return true;
    this.standingUp = true;
    this.ctrl.brake(dt);
    return false;
  }

  /** 먹기 흐름 시작: 그릇으로 다가간다 */
  private startEating(bowl: FoodBowl): void {
    if (this.balloon.amount > 0.05) return; // 떠 있으면 땅에 있는 그릇을 먹을 수 없다
    this.eating = { seq: new EatingSequence(this.rng), bowl };
    this.walkTarget = null;
    this.sniffTarget = null;
    this.petUntil = 0;
    // 자율 행동이 먹는 도중 다른 행동으로 넘어가지 않게 붙잡아 둔다
    this.brain.interrupt('eat', 1e9, this.time);
    this.progressCheck = { at: this.time, x: this.ctrl.x, z: this.ctrl.z };
  }

  /** 직접 조작으로 그릇 앞까지 왔고 배가 고프면 먹기 시작 */
  private startEatingIfAtBowl(): void {
    if (this.save.hunger >= 70) return;
    const bowl = this.nearestFilledBowl(this.eatReach() + 0.05);
    if (!bowl) return;
    this.startEating(bowl);
    this.eating?.seq.arrive();
  }

  private eatReach(): number {
    return 0.3 * this.ctrl.scale + 0.05;
  }

  private updateEating(dt: number, now: number): void {
    const e = this.eating!;
    if (!e.bowl.filled || !e.bowl.group.visible) {
      this.cancelEating();
      return;
    }
    if (e.seq.phase === 'approach') {
      if (!this.readyToMove(dt)) return;
      // 배가 고프고 그릇이 멀면 달려간다 (가까워지면 걷기로)
      const far = Math.hypot(e.bowl.x - this.ctrl.x, e.bowl.z - this.ctrl.z) > 2.5;
      const dash = far && this.save.hunger < 40 && this.mode === 'auto';
      const reached = this.ctrl.walkTo(e.bowl.x, e.bowl.z, dt, this.eatReach(), dash ? RUN_SPEED : WALK_SPEED);
      if (reached) e.seq.arrive();
      else if (this.isStuck(now)) this.cancelEating();
      return;
    }
    // 도착 후: 그릇을 바라보고 냄새 → 먹기 → 입 핥기 (이동 잠금)
    this.ctrl.face(e.bowl.x, e.bowl.z, dt);
    const ev = e.seq.update(dt);
    if (ev.fed) {
      this.save.hunger = feed(this.save.hunger);
      e.bowl.setFilled(false);
      if (e.bowl === this.userBowl) this.userBowlHideAt = now + 3;
      this.emitHud();
    }
    if (ev.done) this.endEating(now);
  }

  /** 먹기 흐름이 끝나면 조작을 돌려준다 */
  private endEating(now: number): void {
    this.eating = null;
    if (this.mode === 'auto') this.finishBehavior(now);
    else this.lastInputAt = now; // 직접 조작 중이었다면 자동 복귀 대기 시간을 다시 센다
  }

  private cancelEating(): void {
    this.eating = null;
    if (this.brain.current.id === 'eat') this.brain.interrupt('lookAround', 2, this.time);
  }

  private returnToAuto(): void {
    this.poseHold.stop();
    this.mode = 'auto';
    this.manualLocked = false;
    this.clearTargets();
    // '둘러보기'로 자연스럽게 이어 간다
    this.brain.interrupt('lookAround', 3, this.time);
    this.emitHud();
  }

  private clearTargets(): void {
    this.walkTarget = null;
    this.sniffTarget = null;
    this.eating = null;
  }

  /**
   * 걷다가 막혔을 때 (목표는 막힘없는 곳만 고르지만, 움직이는 물체 등으로 막힐 수 있다):
   * 그 자리에서 앞의 벽 냄새를 잠깐 맡고, 다음에 걸을 곳은 막힌 방향을 피해 고른다 (사용자 결정 2026-11-08)
   */
  private reactToBlock(now: number): void {
    this.blocked = { at: now, heading: this.ctrl.heading };
    this.walkTarget = null;
    this.onBehaviorEnd('walk');
    this.brain.interrupt('sniff', 1.6, now);
    this.sniffTarget = { x: this.ctrl.x + Math.sin(this.ctrl.heading) * 0.5, z: this.ctrl.z + Math.cos(this.ctrl.heading) * 0.5 };
    this.progressCheck = { at: now, x: this.ctrl.x, z: this.ctrl.z };
  }

  /** 최근(10초 안)에 막혔던 방향(±60°)으로 가는 목표인지 */
  private towardBlocked(x: number, z: number): boolean {
    if (!this.blocked || this.time - this.blocked.at > 10) return false;
    const a = Math.atan2(x - this.ctrl.x, z - this.ctrl.z);
    return Math.abs(Math.atan2(Math.sin(a - this.blocked.heading), Math.cos(a - this.blocked.heading))) < Math.PI / 3;
  }

  /** 지금 자리에서 직선으로 막힘없이 갈 수 있고, 막혔던 방향이 아닌 목표인지 */
  private reachable(x: number, z: number): boolean {
    return !this.towardBlocked(x, z) && pathClear(this.map.collision, this.ctrl.x, this.ctrl.z, x, z, 0.18 * this.ctrl.scale, this.ctrl.y);
  }

  /** 1.5초 동안 거의 못 움직였으면 장애물에 막힌 것 */
  private isStuck(now: number): boolean {
    if (now - this.progressCheck.at < 1.5) return false;
    const moved = Math.hypot(this.ctrl.x - this.progressCheck.x, this.ctrl.z - this.progressCheck.z);
    this.progressCheck = { at: now, x: this.ctrl.x, z: this.ctrl.z };
    return moved < 0.12 * this.ctrl.scale;
  }

  private pickWalkTarget(): { x: number; z: number } {
    const cx = this.ctrl.x;
    const cz = this.ctrl.z;
    // 배가 고프면 먹이가 든 그릇으로
    if (this.save.hunger < 50) {
      const bowl = [this.stationBowl, this.userBowl].find((b) => b.filled && b.group.visible);
      if (bowl) {
        this.startEating(bowl);
        this.audio.meow('hungry');
        return { x: this.ctrl.x, z: this.ctrl.z };
      }
    }
    // 대부분은 근처 관심 지점(화분, 풀, 차, 햇볕 자리 등)으로
    if (this.rng() < 0.65) {
      const near = this.map.interests.filter((i) => Math.hypot(i.x - cx, i.z - cz) < 10 && Math.hypot(i.x - cx, i.z - cz) > 1);
      if (near.length) {
        const it = near[Math.floor(this.rng() * near.length)];
        const t = this.approachPoint(it);
        if (t) return t;
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = 1.5 + this.rng() * 5;
      const x = cx + Math.sin(a) * d;
      const z = cz + Math.cos(a) * d;
      if (isFree(this.map.collision, x, z, 0.25) && this.reachable(x, z)) return { x, z };
    }
    return { x: cx, z: cz };
  }

  /** 관심 지점으로 걸어갈 위치: 반경 가장자리 중 고양이 쪽의 비어 있는 곳 */
  private approachPoint(it: Interest): { x: number; z: number } | null {
    const base = Math.atan2(this.ctrl.x - it.x, this.ctrl.z - it.z);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = base + off;
      const x = it.x + Math.sin(a) * it.r * 0.8;
      const z = it.z + Math.cos(a) * it.r * 0.8;
      if (isFree(this.map.collision, x, z, 0.2) && this.reachable(x, z)) return { x, z };
    }
    return null;
  }

  private senses(): Senses {
    return { nearby: this.nearbyKinds(), hunger: this.save.hunger, fold: this.save.cat.ear === 'fold' };
  }

  private nearbyKinds(): InterestKind[] {
    const kinds = new Set<InterestKind>();
    for (const i of this.map.interests) {
      if (Math.hypot(i.x - this.ctrl.x, i.z - this.ctrl.z) < i.r + 0.4) kinds.add(i.kind);
    }
    if (this.nearestFilledBowl(1.6)) kinds.add('food');
    return [...kinds];
  }

  private nearestInterest(kinds: InterestKind[]): { x: number; z: number } | null {
    let best: Interest | null = null;
    let bestD = Infinity;
    for (const i of this.map.interests) {
      if (!kinds.includes(i.kind)) continue;
      const d = Math.hypot(i.x - this.ctrl.x, i.z - this.ctrl.z);
      if (d < i.r + 0.6 && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  private nearestFilledBowl(maxDist: number): FoodBowl | null {
    for (const b of [this.userBowl, this.stationBowl]) {
      if (b.filled && b.group.visible && Math.hypot(b.x - this.ctrl.x, b.z - this.ctrl.z) < maxDist) return b;
    }
    return null;
  }

  // ---------------------------------------------------------------- 쓰다듬기 (고양이 클릭)

  private attachPetting(): void {
    const dom = this.stage.renderer.domElement;
    const ray = new THREE.Raycaster();
    ray.layers.enableAll();
    let down = { x: 0, y: 0 };
    dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointerup', (e) => {
      if (this.phase !== 'play' || this.cam.mode !== 'follow') return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // 드래그는 카메라 회전
      const rect = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, this.cam.active);
      if (ray.intersectObject(this.rig.root, true).length === 0) return;
      this.audio.purr(5);
      if (this.eating?.seq.locksMovement) return; // 먹는 중에는 골골송만, 자세는 그대로
      this.petUntil = this.time + 4.5;
      if (this.mode === 'auto') {
        this.clearTargets();
        this.brain.interrupt('sit', 6, this.time);
      }
    });
  }

  private emitHud(): void {
    this.onHud({ hunger: this.save.hunger, mode: this.mode, manualLocked: this.manualLocked, camera: this.cam.mode });
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.stage.resize(w, h);
    this.cam.setAspect(w / h);
  }
}

/** 보내는 숫자를 줄인다 (소수 셋째 자리) */
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
