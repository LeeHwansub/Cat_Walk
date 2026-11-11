import * as THREE from 'three';
import { effectiveScale, type CatAppearance } from '../cat/appearance';
import { CatAnimator } from '../cat/CatAnimator';
import { WALK_SPEED } from '../cat/CatController';
import type { CatRig } from '../cat/rig';
import { sampleSnapshots, type Snapshot } from './interp';
import type { AnimBehavior } from '../behavior/types';
import type { PeerInfo, ServerMessage } from './protocol';

/** 받은 상태보다 이만큼(초) 늦게 그린다: 다음 상태가 올 때까지 이어 그릴 여유 */
const DELAY = 0.15;
/** 이보다 멀면 닉네임·말풍선을 숨긴다 (m) */
const LABEL_RANGE = 25;
const BUBBLE_SECONDS = 6;

class RemoteCat {
  readonly rig: CatRig;
  private readonly animator = new CatAnimator();
  private readonly snaps: Snapshot[] = [];
  private behavior: AnimBehavior = 'idle';
  private since = 0;
  private gait = 0;
  private last: { x: number; z: number } | null = null;
  private readonly scale: number;
  readonly label: HTMLDivElement;
  private readonly name: HTMLSpanElement;
  private readonly bubble: HTMLSpanElement;
  private bubbleUntil = 0;

  constructor(
    readonly info: PeerInfo,
    makeRig: (look: CatAppearance) => CatRig,
    overlay: HTMLElement,
    now: number,
  ) {
    this.rig = makeRig(info.look);
    this.rig.setFurQuality('low'); // 다른 사람 고양이는 가벼운 털 (여러 마리를 그린다)
    this.scale = effectiveScale(info.look.stage, info.look.size);
    this.rig.root.visible = false; // 첫 상태를 받기 전에는 숨긴다
    if (info.s) this.push(info.s, now);
    this.label = document.createElement('div');
    this.label.className = 'net-label';
    this.bubble = document.createElement('span');
    this.bubble.className = 'net-bubble hidden';
    this.name = document.createElement('span');
    this.name.className = 'net-name';
    this.name.textContent = info.nick; // 글자로만 넣는다 (HTML로 해석하지 않음)
    this.label.append(this.bubble, this.name);
    overlay.appendChild(this.label);
  }

  push(s: PeerInfo['s'] & object, now: number): void {
    this.snaps.push({ t: now, s });
    // 1초 넘게 지난 상태는 버린다 (마지막 둘은 남김)
    while (this.snaps.length > 2 && this.snaps[1].t < now - 1) this.snaps.shift();
    this.rig.root.visible = true;
  }

  say(text: string, now: number): void {
    this.bubble.textContent = text;
    this.bubble.classList.remove('hidden');
    this.bubbleUntil = now + BUBBLE_SECONDS;
  }

  update(now: number, dt: number, camera: THREE.Camera, view: { w: number; h: number }): void {
    const s = sampleSnapshots(this.snaps, now - DELAY);
    if (!s) return;
    if (s.b !== this.behavior) {
      this.behavior = s.b;
      this.since = now;
    }
    // 걸음 주기: 실제로 옮겨 간 거리로 (CatController와 같은 식)
    const speedScale = Math.pow(this.scale, 0.6);
    if (this.last) {
      const moved = Math.hypot(s.x - this.last.x, s.z - this.last.z);
      if (moved < 3) {
        const norm = Math.min(1, Math.max(0.3, s.v / (WALK_SPEED * speedScale)));
        this.gait = (this.gait + moved / (this.rig.cycleLength * this.scale * norm)) % 1;
      }
    }
    this.last = { x: s.x, z: s.z };
    const pose = this.animator.update(
      { behavior: this.behavior, progress: s.g, elapsed: now - this.since, speed: s.v / speedScale, turnRate: 0, gaitPhase: this.gait, petted: false },
      dt,
    );
    this.rig.root.position.set(s.x, s.y, s.z);
    this.rig.root.rotation.set(-s.p, s.h, 0, 'YXZ');
    this.rig.apply(pose, now);

    if (now > this.bubbleUntil) this.bubble.classList.add('hidden');
    const p = new THREE.Vector3(s.x, s.y + 0.48 * this.scale, s.z);
    const far = p.distanceTo(camera.position) > LABEL_RANGE;
    p.project(camera);
    const hidden = far || p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2;
    this.label.classList.toggle('hidden', hidden);
    if (!hidden) this.label.style.transform = `translate(${((p.x + 1) / 2) * view.w}px, ${((1 - p.y) / 2) * view.h}px) translate(-50%, -100%)`;
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    // 고양이마다 새로 만든 재질만 정리한다 (도형은 원본 모델과 함께 쓴다)
    this.rig.root.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.dispose();
    });
    this.label.remove();
  }
}

/**
 * 같은 방에 있는 다른 사람들의 고양이 (D-59): 받은 상태를 조금 늦게 이어 그리고, 머리 위에 닉네임·말풍선을 띄운다.
 * 내 화면에서만 보이는 모습이다 (충돌·먹이·주민과는 상관없음)
 */
export class RemotePlayers {
  /** 채팅을 받으면 (채팅 기록 표시용). mine: 내가 보낸 것 */
  onChat: (nick: string, text: string, mine: boolean) => void = () => {};
  /** 방 인원이 바뀌면 (나 포함) */
  onCount: (n: number) => void = () => {};

  private readonly cats = new Map<string, RemoteCat>();
  private myId: string | null = null;
  readonly overlay: HTMLDivElement;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly makeRig: (look: CatAppearance) => CatRig,
  ) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'net-overlay';
    document.body.appendChild(this.overlay);
  }

  get count(): number {
    return this.cats.size + (this.myId ? 1 : 0);
  }

  handle(m: ServerMessage, now: number): void {
    switch (m.t) {
      case 'welcome':
        this.clear();
        this.myId = m.id;
        for (const p of m.peers) this.add(p, now);
        break;
      case 'join':
        if (m.peer.id !== this.myId) this.add(m.peer, now);
        break;
      case 'leave':
        this.cats.get(m.id)?.dispose();
        this.cats.delete(m.id);
        break;
      case 's':
        this.cats.get(m.id)?.push(m.s, now);
        return;
      case 'chat':
        this.cats.get(m.id)?.say(m.text, now);
        this.onChat(m.nick, m.text, m.id === this.myId);
        return;
    }
    this.onCount(this.count);
  }

  update(now: number, dt: number, camera: THREE.Camera, view: { w: number; h: number }): void {
    for (const c of this.cats.values()) c.update(now, dt, camera, view);
  }

  /** 모두 지운다 (방을 나가거나 바꿀 때) */
  clear(): void {
    for (const c of this.cats.values()) c.dispose();
    this.cats.clear();
    this.myId = null;
    this.onCount(0);
  }

  private add(p: PeerInfo, now: number): void {
    if (this.cats.has(p.id)) return;
    const c = new RemoteCat(p, this.makeRig, this.overlay, now);
    this.scene.add(c.rig.root);
    this.cats.set(p.id, c);
  }
}
