import { describe, expect, it } from 'vitest';
import { mapMenuItems, shouldSwitch } from '../src/ui/mapMenu';

const maps = [
  { id: 'neighborhood', name: '골목과 공원', blurb: '주택가 골목과 연못이 있는 작은 공원' },
  { id: 'meadow', name: '들판', blurb: '넓은 풀밭' },
];

describe('지도 메뉴 (D-58 3단계)', () => {
  it('맵마다 이름·소개를 보여 주고, 지금 있는 맵에 표시한다', () => {
    const items = mapMenuItems(maps, 'meadow');
    expect(items.map((i) => i.id)).toEqual(['neighborhood', 'meadow']);
    expect(items[0]).toMatchObject({ name: '골목과 공원', blurb: '주택가 골목과 연못이 있는 작은 공원', current: false });
    expect(items[1].current).toBe(true);
  });

  it('지금 맵 id를 모르면(손상된 저장) 표시된 맵이 없다', () => {
    expect(mapMenuItems(maps, 'nowhere').some((i) => i.current)).toBe(false);
  });

  it('다른 맵을 고르면 옮기고, 지금 맵이나 목록에 없는 id는 옮기지 않는다', () => {
    expect(shouldSwitch(maps, 'neighborhood', 'meadow')).toBe(true);
    expect(shouldSwitch(maps, 'neighborhood', 'neighborhood')).toBe(false);
    expect(shouldSwitch(maps, 'neighborhood', 'nowhere')).toBe(false);
  });
});
