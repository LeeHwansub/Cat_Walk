import * as THREE from 'three';

const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');

/**
 * 동작 클립에서 뼈별 회전·위치를 직접 계산한다 (뼈는 건드리지 않음).
 *
 * AnimationMixer를 쓰지 않는 이유: Mixer는 계산값이 직전과 같으면 뼈에 다시 쓰지 않는다.
 * 이 모델은 매 프레임 뼈를 기준 자세로 되돌린 뒤 섞기 때문에, 고양이가 멈춰 걸음 위상이
 * 그대로면 클립 값이 쓰이지 않아 자세가 틀어졌다 (2026-11-07 "멈추면 앞발을 들어 올림" 버그).
 */
export class ClipSampler {
  readonly duration: number;
  /** bones와 같은 순서. has*가 false면 그 뼈는 트랙이 없다 */
  readonly q: THREE.Quaternion[];
  readonly p: THREE.Vector3[];
  readonly hasQ: boolean[];
  readonly hasP: boolean[];
  private readonly qi: (THREE.Interpolant | null)[];
  private readonly pi: (THREE.Interpolant | null)[];

  constructor(clip: THREE.AnimationClip, bones: THREE.Object3D[]) {
    this.duration = clip.duration;
    const find = (bone: THREE.Object3D, prop: string) => {
      const t = clip.tracks.find((tr) => {
        const dot = tr.name.lastIndexOf('.');
        return tr.name.slice(dot + 1) === prop && norm(tr.name.slice(0, dot)) === norm(bone.name);
      });
      // createInterpolant는 보간 방식에 따라 실행 중에 붙는 메서드라 타입 정의에 없다
      return t ? (t as unknown as { createInterpolant(): THREE.Interpolant }).createInterpolant() : null;
    };
    this.qi = bones.map((b) => find(b, 'quaternion'));
    this.pi = bones.map((b) => find(b, 'position'));
    this.q = bones.map(() => new THREE.Quaternion());
    this.p = bones.map(() => new THREE.Vector3());
    this.hasQ = this.qi.map((x) => x !== null);
    this.hasP = this.pi.map((x) => x !== null);
  }

  /** time(초) 시점의 값을 q·p에 채운다 */
  sample(time: number): void {
    const t = THREE.MathUtils.clamp(time, 0, this.duration);
    for (let i = 0; i < this.q.length; i++) {
      const qi = this.qi[i];
      if (qi) {
        const v = qi.evaluate(t);
        this.q[i].set(v[0], v[1], v[2], v[3]).normalize();
      }
      const pi = this.pi[i];
      if (pi) {
        const v = pi.evaluate(t);
        this.p[i].set(v[0], v[1], v[2]);
      }
    }
  }
}
