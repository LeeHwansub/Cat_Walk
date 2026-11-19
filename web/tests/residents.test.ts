import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RESIDENT_FILES, Resident, WAVE_DIST } from '../src/systems/npc';
import { isFree } from '../src/world/collision';
import { mapById } from '../src/world/maps';

// 지도의 캔버스 텍스처용 가짜 캔버스 (Node에는 document가 없다)
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 0 }) : noop), apply: () => noop });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => noop }) };

const fs = (globalThis as unknown as { process: { getBuiltinModule(id: string): { readFileSync(p: string): Uint8Array } } }).process.getBuiltinModule('node:fs');

/** glb 파일의 JSON 부분 (노드·재질 이름 확인용) */
function glbJson(file: string): { nodes: { name: string }[]; materials: { name: string }[] } {
  const bytes = new Uint8Array(fs.readFileSync(`public/assets/models/${file}`));
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
}

/** glb와 같은 짜임의 가짜 모델: 부위 넷, 머리는 목, 팔은 어깨에 원점 */
function fakeModel(): THREE.Object3D {
  const root = new THREE.Group();
  const part = (name: string, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial());
    m.name = name;
    m.position.set(x, y, 0);
    root.add(m);
  };
  part('body', 0, 0);
  part('head', 0, 1.4);
  part('armL', -0.2, 1.3);
  part('armR', 0.2, 1.3);
  return root;
}

const dt = 1 / 30;
function run(r: Resident, from: number, seconds: number, cat: { x: number; z: number }, bowlEmpty = false) {
  let refill = false;
  let t = from;
  for (; t < from + seconds; t += dt) refill = r.update(t, dt, cat, bowlEmpty) || refill;
  return { t, refill };
}

describe('눈 오는 광장 주민: 산타와 루돌프 (4단계)', () => {
  const xmas = mapById('xmas').build({});

  it('눈 오는 광장에는 주민이 둘: 급식소 옆 산타가 그릇을 채우고, 루돌프는 입구에서 맞는다', () => {
    const rs = xmas.residents!;
    expect(rs.map((r) => r.kind)).toEqual(['santa', 'rudolph']);
    expect(rs[0]).toMatchObject({ x: xmas.npcSpot.x, z: xmas.npcSpot.z, feeds: true });
    expect(rs[1].feeds).toBe(false);
    expect(rs[1].z).toBeLessThan(-4); // 남쪽 입구 쪽
    for (const r of rs) expect(isFree(xmas.collision, r.x, r.z, 0.35), r.kind).toBe(true);
    expect(Math.hypot(rs[0].x - rs[1].x, rs[0].z - rs[1].z)).toBeGreaterThan(3);
  });

  it('다른 맵은 지금처럼 주민 한 명(도형 모델)', () => {
    for (const id of ['neighborhood', 'meadow', 'farm']) expect(mapById(id).build({}).residents, id).toBeUndefined();
  });

  it('모델 파일: 부위 넷(body·head·armL·armR), 루돌프 코는 빛나는 재질', () => {
    expect(RESIDENT_FILES).toEqual({ santa: 'resident-santa.glb', rudolph: 'resident-rudolph.glb' });
    for (const file of Object.values(RESIDENT_FILES)) {
      const names = glbJson(file).nodes.map((n) => n.name);
      for (const p of ['body', 'head', 'armL', 'armR']) expect(names, `${file} ${p}`).toContain(p);
    }
    expect(glbJson('resident-rudolph.glb').materials.map((m) => m.name)).toContain('glow');
  });

  it('고양이가 다가오면 손을 흔들고, 몇 초 뒤 내린다', () => {
    const r = new Resident(0, 0, 0, { model: fakeModel(), kind: 'rudolph' });
    let { t } = run(r, 0, 2, { x: 10, z: 10 });
    expect(Math.abs(r.waveArm!.rotation.z)).toBeLessThan(0.1);
    ({ t } = run(r, t, 1, { x: 0, z: WAVE_DIST - 0.5 }));
    expect(Math.abs(r.waveArm!.rotation.z)).toBeGreaterThan(1.5); // 팔을 들어 흔든다
    ({ t } = run(r, t, 6, { x: 0, z: WAVE_DIST - 0.5 }));
    expect(Math.abs(r.waveArm!.rotation.z)).toBeLessThan(0.2); // 계속 곁에 있어도 한 번 인사하고 내린다
  });

  it('흔드는 팔은 바깥 위로 들린다 (몸을 뚫지 않는다)', () => {
    const r = new Resident(0, 0, 0, { model: fakeModel(), kind: 'rudolph' });
    run(r, 0, 1, { x: 0, z: 1 });
    const hand = new THREE.Vector3(0, -0.5, 0).applyEuler(r.waveArm!.rotation);
    expect(hand.x).toBeLessThan(-0.2);
    expect(hand.y).toBeGreaterThan(0);
  });

  it('산타는 고양이가 가까이 있으면 웃듯이 배가 들썩인다 (멀면 숨쉬기만)', () => {
    const bounce = (cat: { x: number; z: number }) => {
      const r = new Resident(0, 0, 0, { model: fakeModel(), kind: 'santa' });
      let { t } = run(r, 0, 2, cat);
      let most = 0;
      for (let i = 0; i < 60; i++, t += dt) {
        r.update(t, dt, cat, false);
        most = Math.max(most, Math.abs(r.root.position.y));
      }
      return most;
    };
    expect(bounce({ x: 0, z: 1.5 })).toBeGreaterThan(0.008);
    expect(bounce({ x: 20, z: 20 })).toBeLessThan(0.006);
  });

  it('그릇은 채우는 주민만 채운다', () => {
    const feeder = new Resident(0, 0, 0, { model: fakeModel(), kind: 'santa', feeds: true });
    const other = new Resident(0, 0, 0, { model: fakeModel(), kind: 'rudolph', feeds: false });
    expect(run(feeder, 30, 3, { x: 0, z: 1 }, true).refill).toBe(true);
    expect(run(other, 30, 3, { x: 0, z: 1 }, true).refill).toBe(false);
  });

  it('모델이 없으면 지금 도형 주민 그대로 (그릇 채우기도 그대로)', () => {
    const r = new Resident(0, 0, 0);
    expect(r.waveArm).toBeNull();
    expect(run(r, 30, 3, { x: 0, z: 1 }, true).refill).toBe(true);
  });

  it('얼굴 높이·몸 반지름: 고양이가 쳐다볼 자리와 부딪힐 자리', () => {
    expect(new Resident(0, 0, 0, { model: fakeModel(), kind: 'santa' }).radius).toBeGreaterThan(0.3);
    expect(new Resident(0, 0, 0, { model: fakeModel(), kind: 'rudolph' }).faceHeight).toBeCloseTo(1.59, 2);
    expect(new Resident(0, 0, 0).faceHeight).toBeCloseTo(1.55, 2);
  });
});
