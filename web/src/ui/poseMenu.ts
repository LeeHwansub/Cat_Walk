import type { BehaviorId } from '../behavior/types';

/** 포즈 메뉴의 자세 (원 위 순서: 위에서 시계 방향). 실루엣은 assets/ui/poses/<id>.png */
export const POSE_MENU: { id: BehaviorId; label: string }[] = [
  { id: 'sit', label: '앉기' },
  { id: 'manSit', label: '아저씨 앉기' },
  { id: 'loaf', label: '식빵' },
  { id: 'nap', label: '낮잠' },
  { id: 'tailWrap', label: '옆으로 눕기' }, // 꼬리 감기 자세 (사용자 결정 2026-11-09)
  { id: 'stretch', label: '기지개' },
  { id: 'groom', label: '그루밍' },
  { id: 'lookAround', label: '둘러보기' },
];

export interface Point {
  x: number;
  y: number;
}

/**
 * 고양이(center) 둘레에 n개를 같은 간격으로 놓는다 (첫 칸은 바로 위, 시계 방향).
 * 원 전체(칸 크기 item 포함)가 화면 안에 들어오게 반지름을 줄이고 가운데를 옮긴다
 */
export function ringLayout(n: number, center: Point, radius: number, viewport: { width: number; height: number }, item: number): Point[] {
  const half = item / 2;
  const r = Math.max(0, Math.min(radius, viewport.width / 2 - half, viewport.height / 2 - half));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const cx = clamp(center.x, r + half, viewport.width - r - half);
  const cy = clamp(center.y, r + half, viewport.height - r - half);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
  });
}
