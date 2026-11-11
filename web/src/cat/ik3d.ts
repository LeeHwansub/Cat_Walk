import * as THREE from 'three';

/**
 * 뼈대 모델용 3D 2관절 IK (Daniel Holden의 해석적 방법).
 * a(엉덩이·어깨) → b(무릎·팔꿈치) → c(발목·발)의 월드 위치를 보고, c가 target(월드)에 오도록
 * a와 b의 회전을 바꾼다. 굽는 방향은 지금 자세의 굽은 면을 따르고, 일직선이라 면을 알 수 없을 때만
 * bendAxis(월드)를 쓴다. 호출 전에 부모 행렬이 최신이어야 한다.
 */
export function solveTwoBoneIK(a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, target: THREE.Vector3, bendAxis: THREE.Vector3): void {
  a.updateWorldMatrix(true, true);
  const A = a.getWorldPosition(_a);
  const B = b.getWorldPosition(_b);
  const C = c.getWorldPosition(_c);
  const lab = B.distanceTo(A);
  const lcb = C.distanceTo(B);
  if (lab < 1e-9 || lcb < 1e-9) return;
  const eps = (lab + lcb) * 1e-4;
  const lat = THREE.MathUtils.clamp(target.distanceTo(A), eps, lab + lcb - eps);

  const ac = _ac.subVectors(C, A).normalize();
  const ab = _ab.subVectors(B, A).normalize();
  const ba = _ba.subVectors(A, B).normalize();
  const bc = _bc.subVectors(C, B).normalize();
  const at = _at.subVectors(target, A);
  if (at.lengthSq() < 1e-18) return;
  at.normalize();

  const acAb0 = Math.acos(clamp1(ac.dot(ab)));
  const baBc0 = Math.acos(clamp1(ba.dot(bc)));
  const acAb1 = Math.acos(clamp1((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)));
  const baBc1 = Math.acos(clamp1((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb)));

  const axis0 = _axis0.crossVectors(ac, ab);
  if (axis0.lengthSq() < 1e-12) axis0.copy(bendAxis);
  axis0.normalize();

  // 1) 굽힌 면 안에서 a·b를 돌려 a→c 거리를 목표 거리로 맞춘다 (월드 회전 → 로컬 축으로 바꿔 곱함)
  const aInv = _qai.copy(a.getWorldQuaternion(_qa)).invert();
  const bInv = _qbi.copy(b.getWorldQuaternion(_qb)).invert();
  a.quaternion.multiply(_r0.setFromAxisAngle(_v.copy(axis0).applyQuaternion(aInv), acAb1 - acAb0));
  b.quaternion.multiply(_r1.setFromAxisAngle(_v.copy(axis0).applyQuaternion(bInv), baBc1 - baBc0));
  a.updateWorldMatrix(false, true);

  // 2) a를 통째로 돌려 a→c 방향을 목표 방향에 맞춘다
  const ac2 = _ac.subVectors(c.getWorldPosition(_c), A).normalize();
  _r2.setFromUnitVectors(ac2, at);
  setWorldQuaternion(a, _qa.copy(a.getWorldQuaternion(_qb)).premultiply(_r2));
  a.updateWorldMatrix(false, true);
}

/** 월드 회전이 q가 되도록 로컬 회전을 정한다 (부모 행렬이 최신이어야 함) */
export function setWorldQuaternion(o: THREE.Object3D, q: THREE.Quaternion): void {
  if (o.parent) {
    o.parent.getWorldQuaternion(_qp);
    o.quaternion.copy(_qp.invert()).multiply(q);
  } else {
    o.quaternion.copy(q);
  }
}

const clamp1 = (v: number) => Math.min(1, Math.max(-1, v));
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ba = new THREE.Vector3();
const _bc = new THREE.Vector3();
const _at = new THREE.Vector3();
const _axis0 = new THREE.Vector3();
const _v = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qai = new THREE.Quaternion();
const _qbi = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _r0 = new THREE.Quaternion();
const _r1 = new THREE.Quaternion();
const _r2 = new THREE.Quaternion();
