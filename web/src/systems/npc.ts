import * as THREE from 'three';

/**
 * 주민 NPC 1명 (기획서 12.2). 급식소 근처에 서 있고, 고양이가 다가오면 고개를 돌려 바라본다.
 * 그릇이 비어 있을 때 고양이가 오면 먹이를 채워 준다. (기획서 8.2)
 */
export class Resident {
  readonly group = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly arm: THREE.Group;
  private refillAt = -1;
  private lastRefill = -100;

  constructor(
    public readonly x: number,
    public readonly z: number,
    private readonly facing: number,
  ) {
    const m = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    for (const s of [-1, 1]) add(this.group, new THREE.CapsuleGeometry(0.07, 0.7, 4, 8), m('#4a5160'), 0.1 * s, 0.45, 0);
    add(this.group, new THREE.CapsuleGeometry(0.19, 0.5, 6, 12), m('#c98b6b'), 0, 1.15, 0);
    this.arm = new THREE.Group();
    this.arm.position.set(0.24, 1.38, 0);
    add(this.arm, new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), m('#c98b6b'), 0, -0.28, 0);
    this.group.add(this.arm);
    const otherArm = add(this.group, new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), m('#c98b6b'), -0.24, 1.1, 0);
    otherArm.rotation.z = -0.1;
    this.head.position.set(0, 1.62, 0);
    add(this.head, new THREE.SphereGeometry(0.13, 16, 12), m('#e9c3a3'), 0, 0, 0);
    add(this.head, new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m('#3a3330'), 0, 0.02, -0.01);
    this.group.add(this.head);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = facing;
  }

  /** 그릇을 채울 때가 되면 true */
  update(now: number, dt: number, cat: { x: number; z: number }, bowlEmpty: boolean): boolean {
    const dx = cat.x - this.x;
    const dz = cat.z - this.z;
    const dist = Math.hypot(dx, dz);
    // 고개가 고양이를 따라간다
    const local = Math.atan2(dx, dz) - this.facing;
    const wrapped = Math.atan2(Math.sin(local), Math.cos(local));
    const targetYaw = dist < 4 ? THREE.MathUtils.clamp(wrapped, -1, 1) : Math.sin(now * 0.2) * 0.3;
    const targetPitch = dist < 4 ? 0.35 : 0.1;
    this.head.rotation.y += (targetYaw - this.head.rotation.y) * (1 - Math.exp(-3 * dt));
    this.head.rotation.x += (targetPitch - this.head.rotation.x) * (1 - Math.exp(-3 * dt));

    let refill = false;
    if (bowlEmpty && dist < 2.2 && this.refillAt < 0 && now - this.lastRefill > 20) this.refillAt = now + 1.5;
    if (this.refillAt > 0 && now >= this.refillAt) {
      this.refillAt = -1;
      this.lastRefill = now;
      refill = true;
    }
    // 먹이 줄 때 팔 동작
    const pour = now - this.lastRefill < 1.2 || this.refillAt > 0 ? 1 : 0;
    this.arm.rotation.x += (-pour * 0.9 - this.arm.rotation.x) * (1 - Math.exp(-5 * dt));
    return refill;
  }
}
