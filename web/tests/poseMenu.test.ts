import { describe, expect, it } from 'vitest';
import { PoseHold, POSE_HOLD } from '../src/behavior/poseHold';
import { DURATION } from '../src/behavior/selector';
import { POSE_MENU, ringLayout } from '../src/ui/poseMenu';

describe('포즈 메뉴 목록', () => {
  it('자세 8가지, 이름이 있고 겹치지 않는다', () => {
    const ids = POSE_MENU.map((p) => p.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    for (const id of ['sit', 'manSit', 'loaf', 'nap', 'tailWrap', 'groom', 'stretch', 'lookAround'] as const) expect(ids).toContain(id);
    // 배 보이기(아저씨 앉기와 겹침)는 빼고, "옆으로 눕기" 버튼은 꼬리 감기 자세를 한다 (사용자 결정 2026-11-09). 자동 생활은 그대로
    for (const id of ['bellyUp', 'sideLie'] as const) expect(ids).not.toContain(id);
    expect(POSE_MENU.find((p) => p.id === 'tailWrap')?.label).toBe('옆으로 눕기');
    for (const p of POSE_MENU) expect(p.label.length).toBeGreaterThan(0);
    for (const id of ids) expect(DURATION[id]).toBeDefined(); // 게임에 있는 행동
  });
});

describe('원형 배치 (ringLayout)', () => {
  const vp = { width: 1280, height: 720 };

  it('고양이를 가운데에 두고 같은 간격으로 원 위에 놓는다 (첫 칸은 위)', () => {
    const pts = ringLayout(10, { x: 640, y: 400 }, 150, vp, 80);
    expect(pts).toHaveLength(10);
    for (const p of pts) expect(Math.hypot(p.x - 640, p.y - 400)).toBeCloseTo(150);
    expect(pts[0].x).toBeCloseTo(640);
    expect(pts[0].y).toBeCloseTo(250);
    const gap = (i: number) => Math.hypot(pts[(i + 1) % 10].x - pts[i].x, pts[(i + 1) % 10].y - pts[i].y);
    for (let i = 0; i < 10; i++) expect(gap(i)).toBeCloseTo(gap(0));
  });

  it('고양이가 화면 가장자리에 있으면 원 전체가 화면 안에 들어오게 옮긴다', () => {
    for (const c of [{ x: 10, y: 10 }, { x: 1270, y: 710 }, { x: 640, y: 700 }]) {
      const pts = ringLayout(10, c, 150, vp, 80);
      for (const p of pts) {
        expect(p.x - 40).toBeGreaterThanOrEqual(0);
        expect(p.x + 40).toBeLessThanOrEqual(vp.width);
        expect(p.y - 40).toBeGreaterThanOrEqual(0);
        expect(p.y + 40).toBeLessThanOrEqual(vp.height);
      }
    }
  });

  it('화면이 원보다 작으면(휴대폰 세로) 반지름을 줄여 들어오게 한다', () => {
    const small = { width: 360, height: 640 };
    const pts = ringLayout(10, { x: 180, y: 320 }, 170, small, 64);
    for (const p of pts) {
      expect(p.x - 32).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x + 32).toBeLessThanOrEqual(360 + 1e-6);
    }
  });
});

describe('고른 자세 유지 (PoseHold)', () => {
  it('누운·앉은 자세는 움직일 때까지 유지한다 (아주 긴 시간)', () => {
    const h = new PoseHold();
    const c = h.start('bellyUp');
    expect(c).toEqual({ id: 'bellyUp', duration: POSE_HOLD });
    expect(h.id).toBe('bellyUp');
    expect(h.next(0.5)).toBeNull();
  });

  it('그루밍·기지개·둘러보기는 한 번 한 뒤 앉아서 기다린다', () => {
    for (const id of ['groom', 'stretch', 'lookAround'] as const) {
      const h = new PoseHold();
      const c = h.start(id);
      expect(c.id).toBe(id);
      expect(c.duration).toBeGreaterThanOrEqual(DURATION[id][0]);
      expect(c.duration).toBeLessThanOrEqual(DURATION[id][1]);
      expect(h.next(0.9)).toBeNull();
      expect(h.next(1)).toEqual({ id: 'sit', duration: POSE_HOLD });
      expect(h.id).toBe('sit');
      expect(h.next(1)).toBeNull(); // 앉기는 계속 유지
    }
  });

  it('움직이면(stop) 자세를 끝낸다', () => {
    const h = new PoseHold();
    h.start('loaf');
    h.stop();
    expect(h.id).toBeNull();
    expect(h.next(1)).toBeNull();
  });
});
