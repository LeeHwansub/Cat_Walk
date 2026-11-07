import * as THREE from 'three';
import { AudioManager } from './audio/AudioManager';
import { BehaviorBrain, type Senses } from './behavior/brain';
import type { BehaviorId, InterestKind } from './behavior/types';
import { CameraRig, type CameraMode } from './camera/CameraRig';
import { effectiveScale, girthScale, type CatAppearance } from './cat/appearance';
import { CatAnimator, type AnimBehavior } from './cat/CatAnimator';
import { CatController } from './cat/CatController';
import { resolveFurQuality } from './cat/fur';
import { gazeAngles, GazePicker, type GazePoint } from './cat/gaze';
import { postureBlocksMovement } from './cat/posture';
import { ProceduralCatRig } from './cat/ProceduralCatRig';
import { SkinnedCatRig } from './cat/SkinnedCatRig';
import type { CatRig } from './cat/rig';
import { Input } from './core/input';
import { createRng, type Rng } from './core/rng';
import { browserStore, clearSave, defaultSave, loadSave, writeSave, type KeyValueStore, type SaveData, type Settings } from './save/storage';
import { BalloonFloat, isBalloon } from './systems/balloon';
import { EatingSequence } from './systems/eating';
import { FoodBowl } from './systems/food';
import { feed, tickHunger, type ActivityState } from './systems/hunger';
import { Resident } from './systems/npc';
import { isFree } from './world/collision';
import { buildNeighborhood, type Interest, type Neighborhood } from './world/map/neighborhood';
import { Stage } from './world/scene';

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

  private readonly stage: Stage;
  private readonly map: Neighborhood;
  private readonly rig: CatRig;
  private readonly ctrl: CatController;
  private readonly animator = new CatAnimator();
  private readonly brain: BehaviorBrain;
  private readonly cam: CameraRig;
  readonly audio = new AudioManager();
  private readonly input = new Input(window);
  private readonly store: KeyValueStore = browserStore();
  private readonly rng: Rng = createRng(Date.now() & 0xffff);
  private readonly stationBowl: FoodBowl;
  private readonly userBowl: FoodBowl;
  private readonly npc: Resident;
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
  private petUntil = 0;
  private userBowlHideAt = -1;
  private saveTimer = 0;
  private hudTimer = 0;
  private fadeEl: HTMLElement | null = null;
  private resetting = false;

  /** catModel: 불러온 glb 고양이(없으면 이전 도형 모델) */
  constructor(private readonly container: HTMLElement, catModel: THREE.Object3D | null = null) {
    this.save = loadSave(this.store) ?? defaultSave();
    this.stage = new Stage(container);
    this.map = buildNeighborhood();
    this.stage.scene.add(this.map.group);

    this.rig = catModel ? new SkinnedCatRig(this.save.cat, catModel) : new ProceduralCatRig(this.save.cat);
    this.stage.scene.add(this.rig.root);
    this.ctrl = new CatController(this.map.collision, this.rig.cycleLength, effectiveScale(this.save.cat.stage, this.save.cat.size));
    this.ctrl.girth = girthScale(this.save.cat.build);
    const start = this.save.position && isFree(this.map.collision, this.save.position.x, this.save.position.z, 0.2) ? this.save.position : this.map.spawn;
    this.ctrl.x = start.x;
    this.ctrl.z = start.z;
    this.ctrl.heading = this.map.spawn.heading;

    this.audio.setVoice(this.save.cat.stage === 'kitten', this.save.cat.size);
    this.brain = new BehaviorBrain(this.rng);
    this.brain.interrupt('lookAround', 4, 0);

    const fs = this.map.foodStation;
    this.stationBowl = new FoodBowl(fs.x, fs.z + 0.02);
    this.stationBowl.setFilled(true);
    this.userBowl = new FoodBowl(0, 0, '#f2c4c4');
    this.userBowl.group.visible = false;
    this.npc = new Resident(this.map.npcSpot.x, this.map.npcSpot.z, -2.4);
    this.stage.scene.add(this.stationBowl.group, this.userBowl.group, this.npc.group);
    this.map.collision.circles.push({ x: this.npc.x, z: this.npc.z, r: 0.28 });
    this.gazePicker = new GazePicker(this.rng);
    this.gazePoints = [
      ...this.map.interests.filter((i) => GAZE_HEIGHT[i.kind] !== undefined).map((i) => ({ x: i.x, y: GAZE_HEIGHT[i.kind]!, z: i.z })),
      { x: this.npc.x, y: 1.55, z: this.npc.z }, // 주민 얼굴
    ];

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
    else if (this.mode === 'manual' && this.phase === 'play') animBehavior = 'idle';
    else if (b.id === 'eat') animBehavior = 'idle';
    const view = { x: this.ctrl.x, z: this.ctrl.z, heading: this.ctrl.heading, eyeY: this.floatHeight + 0.25 * this.ctrl.scale };
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
      },
      dt,
    );
    this.rig.root.position.set(this.ctrl.x, this.floatHeight, this.ctrl.z);
    this.rig.root.rotation.y = this.ctrl.heading;
    this.rig.setFirstPerson?.(this.cam.mode === 'cat');
    this.rig.apply(pose, now);

    this.cam.update(dt, now, { x: this.ctrl.x, y: this.floatHeight, z: this.ctrl.z, heading: this.ctrl.heading, speed: this.ctrl.speed, scale: this.ctrl.scale }, this.rig.eyeAnchor, this.map.occluders, this.save.settings.reduceCamShake);
    this.stage.followSun(this.ctrl.x, this.ctrl.z);
    this.audio.update(dt);
    this.stage.renderer.render(this.stage.scene, this.cam.active);
  }

  private handleKeys(): void {
    for (const k of this.input.takePressed()) {
      if (this.phase !== 'play') continue;
      if (k === 'KeyC') this.toggleCamera();
      if (k === 'KeyF') this.giveFood();
    }
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
      this.startEatingIfAtBowl();
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
      if (!this.manualLocked && now - this.lastInputAt > MANUAL_RETURN) this.returnToAuto();
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
        if (arrived || this.isStuck(now)) this.finishBehavior(now);
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
      const reached = this.ctrl.walkTo(e.bowl.x, e.bowl.z, dt, this.eatReach());
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
      if (isFree(this.map.collision, x, z, 0.25)) return { x, z };
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
      if (isFree(this.map.collision, x, z, 0.2)) return { x, z };
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
