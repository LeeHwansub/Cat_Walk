import * as THREE from 'three';

/** 먹이 그릇. 급식소 그릇(주민이 채움)과 사용자가 놓는 그릇 두 가지. */
export class FoodBowl {
  readonly group = new THREE.Group();
  filled = false;
  private readonly food: THREE.Mesh;

  constructor(
    public x: number,
    public z: number,
    color = '#d9dde3',
  ) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.06, 20, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.4, side: THREE.DoubleSide }));
    bowl.position.y = 0.03;
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.08, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.004;
    this.food = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 }));
    this.food.scale.y = 0.35;
    this.food.position.y = 0.035;
    this.group.add(bowl, bottom, this.food);
    this.group.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    this.group.position.set(x, 0, z);
    this.setFilled(false);
  }

  setFilled(v: boolean): void {
    this.filled = v;
    this.food.visible = v;
  }

  moveTo(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.group.position.set(x, 0, z);
  }
}
